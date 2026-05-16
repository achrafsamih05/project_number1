import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Edge-runtime middleware. We re-implement the HMAC check here using Web
// Crypto because Node's `crypto` module isn't available at the edge.
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "nova_session";

function b64urlDecodeToString(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof atob === "function") return atob(base64);
  // Fallback: Buffer exists in Node.
  // @ts-ignore
  return Buffer.from(base64, "base64").toString("utf8");
}

async function hmacB64Url(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  let b64 = "";
  // btoa-friendly encoding
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < sig.length; i++) binary += String.fromCharCode(sig[i]);
    b64 = btoa(binary);
  } else {
    // @ts-ignore
    b64 = Buffer.from(sig).toString("base64");
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifyToken(token: string, secret: string): Promise<{ sub: string; role: string } | null> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacB64Url(secret, body);
  if (expected.length !== sig.length) return null;
  // Constant-time equality via XOR accumulation.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(b64urlDecodeToString(body));
    if (!payload?.sub || !payload?.role) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Only gate /admin/* and admin-only API surfaces. GET /api/settings must
  // be public (the storefront reads storeName/currency), so settings is
  // intentionally NOT in this list — its PATCH handler enforces admin itself.
  const isAdminUI = pathname.startsWith("/admin");
  const isAdminApi =
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/analytics");

  if (!isAdminUI && !isAdminApi) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.NEXTAUTH_SECRET || "nova-dev-secret-change-me";
  const payload = token ? await verifyToken(token, secret) : null;

  const isAdmin = payload?.role === "admin";

  if (isAdmin) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // UI: bounce to admin login, preserving the target so we can redirect back.
  const url = req.nextUrl.clone();
  url.pathname = "/login/admin";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/users/:path*", "/api/analytics/:path*"],
};

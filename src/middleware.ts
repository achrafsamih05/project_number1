import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Edge-runtime middleware — Multi-Tenant + Admin Auth
//
// Responsibilities:
//   1. Tenant Detection: Extract store slug from subdomain or custom domain,
//      inject it into request headers so server components can read it.
//   2. Admin Auth Gating: Verify the HMAC session cookie for /admin/* and
//      admin-only API routes (unchanged from single-store behavior).
//
// Tenant resolution flow:
//   - Request to "nova-shop.commerce-os.com" → tenant slug = "nova-shop"
//   - Request to "www.myshop.com" (custom domain) → tenant slug resolved
//     via header; the server looks up stores.custom_domain
//   - Request to "commerce-os.com" (root domain) → no tenant (marketing site)
//
// The tenant slug is passed downstream via the `x-tenant-slug` header and
// optionally `x-tenant-domain` for custom domain lookups.
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "nova_session";

// Platform root domains. Requests to these WITHOUT a subdomain go to the
// marketing homepage. Subdomains of these are treated as tenant slugs.
const PLATFORM_DOMAINS = [
  "commerce-os.com",
  "nova.com",
  "localhost",
  "127.0.0.1",
];

// Paths that should never be rewritten or tenant-scoped
const EXCLUDED_PATHS = [
  "/_next",
  "/favicon",
  "/assets",
  "/public",
];

// ---------------------------------------------------------------------------
// HMAC verification (Web Crypto — Edge runtime compatible)
// ---------------------------------------------------------------------------

function b64urlDecodeToString(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof atob === "function") return atob(base64);
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

// ---------------------------------------------------------------------------
// Tenant extraction
// ---------------------------------------------------------------------------

interface TenantInfo {
  slug: string | null;
  customDomain: string | null;
  isRootDomain: boolean;
}

function extractTenant(req: NextRequest): TenantInfo {
  const hostname = req.headers.get("host")?.split(":")[0] ?? "";

  // Check if this is a platform root domain (no subdomain → marketing page)
  for (const root of PLATFORM_DOMAINS) {
    if (hostname === root || hostname === `www.${root}`) {
      return { slug: null, customDomain: null, isRootDomain: true };
    }

    // Check for subdomain: "tenant-slug.platform-domain"
    if (hostname.endsWith(`.${root}`)) {
      const subdomain = hostname.replace(`.${root}`, "");
      // Ignore "www" as a subdomain
      if (subdomain && subdomain !== "www") {
        return { slug: subdomain, customDomain: null, isRootDomain: false };
      }
      return { slug: null, customDomain: null, isRootDomain: true };
    }
  }

  // If hostname doesn't match any platform domain, it's a custom domain
  // (e.g., "www.myshop.com" or "store.mybrand.io")
  // Strip "www." prefix for cleaner lookup
  const cleanDomain = hostname.startsWith("www.")
    ? hostname.slice(4)
    : hostname;

  return { slug: null, customDomain: cleanDomain, isRootDomain: false };
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Skip internal Next.js paths and static assets
  if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // --- Tenant Detection ---
  const tenant = extractTenant(req);

  // If this is the root domain with no tenant context, allow through
  // (marketing homepage, onboarding, etc.)
  // We still set headers so downstream code can detect "no tenant" gracefully.
  const requestHeaders = new Headers(req.headers);

  if (tenant.slug) {
    requestHeaders.set("x-tenant-slug", tenant.slug);
  } else if (tenant.customDomain) {
    requestHeaders.set("x-tenant-domain", tenant.customDomain);
  }

  // Always set a flag indicating whether we're on the root/marketing domain
  requestHeaders.set(
    "x-is-platform-root",
    tenant.isRootDomain ? "true" : "false"
  );

  // --- Admin Auth Gating (preserved from original) ---
  const isAdminUI = pathname.startsWith("/admin");
  const isAdminApi =
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/analytics");

  if (isAdminUI || isAdminApi) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const secret = process.env.NEXTAUTH_SECRET || "nova-dev-secret-change-me";
    const payload = token ? await verifyToken(token, secret) : null;
    const isAdmin = payload?.role === "admin";

    if (!isAdmin) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // UI: bounce to admin login
      const url = req.nextUrl.clone();
      url.pathname = "/login/admin";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  // --- Pass tenant info downstream via headers ---
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

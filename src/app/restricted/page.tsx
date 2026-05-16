"use client";

// ---------------------------------------------------------------------------
// /restricted — landing page shown to banned accounts.
//
// We render this as a fully self-contained client page (no StoreShell, no
// AdminShell) for two reasons:
//   1. The shells assume an authenticated, non-banned session for some of
//      their nav surfaces. Putting a banned user back inside them risks
//      flashing protected UI between renders.
//   2. The page must be reachable from every guard path — admin layout
//      redirect, /api/auth/me ban sentinel, login attempts on a banned
//      row — so it stays minimal and dependency-free.
//
// Design intentionally avoids ambiguity: clear explanation, link back to
// the storefront, and a "Sign out" button that hits /api/auth/logout to
// nuke any lingering cookie before the user navigates away.
// ---------------------------------------------------------------------------

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { apiSend } from "@/lib/client/api";

export default function RestrictedPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Best-effort: even if this 401s, the cookie was almost certainly
      // already cleared by /api/auth/me's ban sentinel. We still try so
      // the response Set-Cookie header runs.
      await apiSend("/api/auth/logout", "POST").catch(() => undefined);
      router.replace("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <Icon name="Ban" size={26} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Account restricted
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          This account has been suspended and can no longer access the store
          or admin tools. If you believe this is a mistake, please contact
          support.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={signOut}
            disabled={signingOut}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60"
          >
            <Icon name="LogOut" size={16} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 hover:border-ink-300"
          >
            Back to storefront
          </Link>
        </div>
      </div>
    </main>
  );
}

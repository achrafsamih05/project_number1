"use client";

// ---------------------------------------------------------------------------
// BanGuard
//
// Storefront-side complement to the admin-layout server guard. The flow:
//
//   1. /api/auth/me already clears the session cookie when it sees a banned
//      user, AND returns a `{ banned: true }` sentinel.
//   2. useMe surfaces that sentinel as a separate `banned` flag.
//   3. This component watches that flag while the user is on a normal
//      storefront route (anything that isn't /restricted itself) and
//      redirects them so they cannot keep browsing under a banned identity.
//
// Why client-side rather than middleware? The middleware can't read the
// users table (Edge runtime, no Node `pg`/Supabase service-role on it) and
// we don't want every public route to incur a DB lookup. /api/auth/me
// already runs that lookup once per session; piggy-backing on it keeps the
// design cheap.
//
// Renders nothing — it's a side-effect-only component.
// ---------------------------------------------------------------------------

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/lib/client/hooks";

export function BanGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { banned } = useMe();

  useEffect(() => {
    if (!banned) return;
    // Already on the restricted page — nothing to do, and redirecting
    // would loop the router.
    if (pathname?.startsWith("/restricted")) return;
    router.replace("/restricted");
  }, [banned, pathname, router]);

  return null;
}

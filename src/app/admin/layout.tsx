// ---------------------------------------------------------------------------
// Admin route segment layout.
//
// Why this file exists:
//   - The edge middleware already gates /admin/* on the `role === "admin"`
//     claim, but it CANNOT check the database. A user whose admin session
//     was minted before they got banned is still admin-shaped to the
//     middleware until the cookie expires.
//   - This Node-runtime server layout calls getCurrentUser(), which DOES
//     read the users table and filters banned rows out (returns null). So
//     we get true server-side enforcement of the ban flag every time an
//     admin page renders, with zero client-side bypass possible.
//
// Behaviour matrix (cookie present + admin role at middleware):
//   row not found       → cookie cleared by /api/auth/me on the next call;
//                         here we just redirect to /login/admin.
//   row.banned = true   → redirect to /restricted (and clear the cookie so
//                         the user can't bounce back).
//   row.role != admin   → redirect to /login/admin (defence-in-depth in
//                         case the middleware claim drifts from the DB).
//   ok                  → render children.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ReactNode } from "react";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  getCurrentUser,
  verifySessionToken,
} from "@/lib/server/auth";
import { getUserById } from "@/lib/server/db";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // getCurrentUser() returns null for: missing/invalid token, deleted user,
  // OR banned user. We need to tell those apart so we can route correctly.
  const user = await getCurrentUser();
  if (user && user.role === "admin") {
    return <>{children}</>;
  }

  // Below this point we know there is no usable authenticated admin. Figure
  // out *why* so we can land the visitor on the right page.
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (payload) {
    const stored = await getUserById(payload.sub);
    if (stored?.banned) {
      // Belt-and-braces: clear the cookie before the redirect so the
      // /restricted page doesn't render with a still-warm session.
      clearSessionCookie();
      redirect("/restricted");
    }
  }

  redirect("/login/admin");
}

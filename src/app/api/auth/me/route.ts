import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  getCurrentUser,
  toPublicUser,
  verifySessionToken,
} from "@/lib/server/auth";
import { getUserById, updateUser } from "@/lib/server/db";
import { handle, httpError } from "@/lib/server/http";

// ---------------------------------------------------------------------------
// /api/auth/me
//
// GET: returns the public profile of the currently signed-in user, or null
// when no valid session exists.
//
// Ban handling: getCurrentUser() short-circuits to null when the user is
// banned, but that alone leaves the (still-valid) signed cookie in the
// browser. Subsequent page loads keep going through the session-decode path
// and burning DB lookups until the cookie expires. Worse, the storefront UI
// can't distinguish "never signed in" from "your account was banned just
// now" — both look like null.
//
// To fix both: when the cookie verifies to a real user that turns out to be
// banned, we (a) clear the cookie immediately and (b) reply with a sentinel
// `{ banned: true }` so client code can route the user to /restricted.
// Anyone who isn't banned (or has no cookie at all) gets the existing
// PublicUser-or-null contract.
// ---------------------------------------------------------------------------

export const GET = () =>
  handle(async () => {
    // First try the canonical happy path: a valid, non-banned session.
    const user = await getCurrentUser();
    if (user) return toPublicUser(user);

    // No happy-path user. Distinguish "no session" from "banned session" by
    // re-decoding the cookie ourselves. We do NOT want to surface the user
    // id of every random invalid token, only the case where the signature
    // checks out and the row exists but is banned.
    const token = cookies().get(SESSION_COOKIE)?.value;
    const payload = verifySessionToken(token);
    if (!payload) return null;

    const stored = await getUserById(payload.sub);
    if (!stored) {
      // Token was valid but the user has been deleted. Clear the dangling
      // cookie so we don't keep paying for this lookup on every request.
      clearSessionCookie();
      return null;
    }
    if (stored.banned) {
      clearSessionCookie();
      // Sentinel response. PublicUser never has `banned: true` because
      // getCurrentUser() already filtered banned users out, so the client
      // can safely use this discriminator.
      return { banned: true };
    }
    return null;
  });

// PATCH: update own profile (shipping details, name, etc.)
export const PATCH = (req: NextRequest) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user) httpError(401, "Unauthorized");

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) httpError(400, "Invalid body");

    const allowed = [
      "name",
      "phone",
      "address",
      "city",
      "postalCode",
      "country",
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (typeof body![k] === "string") patch[k] = body![k];
    }

    const updated = await updateUser(user!.id, patch);
    if (!updated) httpError(404, "Not found");
    return toPublicUser(updated!);
  });

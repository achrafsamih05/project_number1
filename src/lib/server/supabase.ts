import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Singleton Supabase clients for the *server* runtime only.
//
// We expose two clients:
//   - `supabase`       : uses SUPABASE_ANON_KEY. Respects Row-Level Security.
//                        Safe for browser-adjacent public reads IF the public
//                        read policies in supabase/schema.sql are in place.
//   - `supabaseAdmin`  : uses SUPABASE_SERVICE_ROLE_KEY. Bypasses RLS. This
//                        is the client every server route should use for
//                        reads AND writes — our own middleware + auth layer
//                        is the single source of truth for authorization.
//
// HISTORICAL NOTE (why every server read uses the admin client):
// Before, server-side reads went through the anon client. If the Supabase
// project had RLS enabled but the public-read policy on `products` /
// `categories` was missing/misnamed, every storefront query silently returned
// `[]` with no error. That is exactly the "empty UI, data is in the DB"
// failure mode this module is hardened against. Routing all server reads
// through the service-role client makes RLS opaque to the server path;
// authorization is enforced in src/middleware.ts and the route handlers.
// ---------------------------------------------------------------------------

const g = globalThis as unknown as {
  __novaSupabase?: SupabaseClient;
  __novaSupabaseAdmin?: SupabaseClient;
  __novaSupabaseWarned?: boolean;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name}. Set it in your .env.local (dev) and Vercel environment variables (prod).`
    );
  }
  return v;
}

/**
 * Anon client. Only use this in code paths that genuinely need RLS to apply
 * (e.g. a future per-user read flow). For every current server route, prefer
 * `getSupabaseAdmin()` — our own auth layer already gates access.
 */
export function getSupabase(): SupabaseClient {
  if (g.__novaSupabase) return g.__novaSupabase;
  const url = requireEnv("SUPABASE_URL");
  const anon = requireEnv("SUPABASE_ANON_KEY");
  g.__novaSupabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return g.__novaSupabase;
}

/**
 * Service-role client. Bypasses RLS. Use this for every server-side read
 * and every write. The service-role key is server-only and must never be
 * shipped to the browser.
 *
 * If SUPABASE_SERVICE_ROLE_KEY is not set we fall back to the anon key so a
 * quick local demo still runs, BUT we warn loudly on every cold start —
 * silent fallback to anon is the single most common cause of "my data is in
 * Supabase but the UI is empty" because RLS then filters writes/reads away
 * with zero error surface.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (g.__novaSupabaseAdmin) return g.__novaSupabaseAdmin;
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let key: string;
  if (serviceKey && serviceKey.length > 0) {
    key = serviceKey;
  } else {
    key = requireEnv("SUPABASE_ANON_KEY");
    if (!g.__novaSupabaseWarned) {
      g.__novaSupabaseWarned = true;
      // eslint-disable-next-line no-console
      console.warn(
        "\n" +
          "================================================================\n" +
          "[supabase] SUPABASE_SERVICE_ROLE_KEY is NOT set.\n" +
          "  Server routes are falling back to the anon key, which means\n" +
          "  Row-Level Security will apply to every query.\n" +
          "  Any table without a matching RLS policy will return 0 rows\n" +
          "  WITH NO ERROR (PostgREST treats 'not allowed' as 'empty').\n" +
          "\n" +
          "  If categories / products / orders / invoices / users show up\n" +
          "  as empty arrays in the UI while rows clearly exist in the DB,\n" +
          "  THIS IS THE REASON.\n" +
          "\n" +
          "  Fix: add SUPABASE_SERVICE_ROLE_KEY to .env.local (dev) and to\n" +
          "  the Vercel project environment variables (prod + preview).\n" +
          "================================================================\n"
      );
    }
  }

  g.__novaSupabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return g.__novaSupabaseAdmin;
}

// -----------------------------------------------------------------------------
// next.config.mjs
//
// `next/image` refuses to render any remote host that is not explicitly listed
// in `images.remotePatterns`. Product images live in Supabase Storage under
// `<project>.supabase.co/storage/v1/object/public/product-images/...`, so we
// MUST whitelist the Supabase host or the storefront <Image> renders a broken
// icon. We derive the host from `SUPABASE_URL` at build/boot time so the
// config stays in lockstep with the active project, and we also allow the
// wildcard `**.supabase.co` / `**.supabase.in` as a safety net for local
// branches, custom domains and the legacy `.in` suffix.
// -----------------------------------------------------------------------------

/**
 * Extract the hostname from SUPABASE_URL so we can add an explicit
 * remotePatterns entry. Returns null if the env var is missing or malformed.
 */
function supabaseHost() {
  const raw = process.env.SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const extraSupabaseHost = supabaseHost();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Order: explicit hosts first, then the safety-net wildcards.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      // Supabase Storage — required for uploaded product images.
      ...(extraSupabaseHost
        ? [{ protocol: "https", hostname: extraSupabaseHost }]
        : []),
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
};

export default nextConfig;

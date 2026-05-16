// -----------------------------------------------------------------------------
// scripts/diagnose-images.ts
//
// Standalone diagnostic for the "broken product image" bug. Run it against
// your live Supabase project and it will tell you, step by step, where the
// chain breaks.
//
//   npx tsx scripts/diagnose-images.ts
//
// What it checks, in order:
//   1. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY env vars.
//   2. Whether the `product-images` bucket exists AND is public.
//   3. A sample of up to 20 products from `public.products` and whether each
//      `image` value is:
//        a) an absolute https:// URL (good)   vs.
//        b) a bare path / filename (bad — double-prefix risk)   vs.
//        c) null/empty.
//   4. For each image URL, performs a HEAD request and reports the HTTP
//      status (200 = served; 400 = bucket/object policy; 404 = missing key).
//   5. Compares the host of every image URL to SUPABASE_URL's host, so you
//      can spot stale URLs left over from a previous project.
//
// This script does NOT mutate anything. Safe to run against prod.
// -----------------------------------------------------------------------------

/* eslint-disable no-console */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "product-images";

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  console.log("== Nova image diagnostic ==\n");

  if (!url) {
    console.error("[FAIL] SUPABASE_URL is not set.");
    process.exit(1);
  }
  if (!serviceKey) {
    console.error(
      "[FAIL] Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is set."
    );
    process.exit(1);
  }
  console.log(`SUPABASE_URL   : ${url}`);
  console.log(
    `Using key      : ${
      process.env.SUPABASE_SERVICE_ROLE_KEY ? "service_role" : "anon (limited)"
    }\n`
  );

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- 1. Bucket state ----------------------------------------------------
  const { data: bucket, error: bucketErr } = await sb.storage.getBucket(BUCKET);
  if (bucketErr || !bucket) {
    console.error(
      `[FAIL] Bucket "${BUCKET}" is not reachable: ${
        bucketErr?.message ?? "not found"
      }`
    );
    console.error(
      "  Fix: create it from the Supabase dashboard or let /api/upload auto-create it."
    );
    process.exit(1);
  }
  if (!bucket.public) {
    console.error(
      `[FAIL] Bucket "${BUCKET}" exists but is PRIVATE. getPublicUrl() returns a URL that won't render.`
    );
    console.error(
      "  Fix: in SQL editor run:\n    update storage.buckets set public = true where id = 'product-images';"
    );
  } else {
    console.log(`[OK]  Bucket "${BUCKET}" exists and is public.`);
  }

  // ---- 2. A sample of products -------------------------------------------
  const { data: products, error: prodErr } = await sb
    .from("products")
    .select("id, sku, image")
    .limit(20);
  if (prodErr) {
    console.error(`[FAIL] Could not read products table: ${prodErr.message}`);
    process.exit(1);
  }
  if (!products || products.length === 0) {
    console.warn("[WARN] No rows in products table. Nothing to diagnose.");
    return;
  }

  console.log(`\nInspecting ${products.length} product image URL(s):\n`);

  const expectedHost = new URL(url).hostname;
  let bad = 0;

  for (const p of products) {
    const img: string | null = p.image;
    const label = `${p.id} (${p.sku})`;

    if (!img) {
      console.warn(`  [empty] ${label}: image is NULL/empty`);
      bad++;
      continue;
    }

    if (!/^https?:\/\//i.test(img)) {
      console.error(
        `  [path ] ${label}: value is not an absolute URL: ${JSON.stringify(
          img
        )}`
      );
      console.error(
        "          The DB should hold the full public URL returned by getPublicUrl(), not a path fragment."
      );
      bad++;
      continue;
    }

    let host: string;
    try {
      host = new URL(img).hostname;
    } catch {
      console.error(`  [url  ] ${label}: malformed URL: ${img}`);
      bad++;
      continue;
    }

    // Network probe. HEAD is enough to tell 200 vs 400/404.
    let status = 0;
    let statusText = "";
    try {
      const res = await fetch(img, { method: "HEAD" });
      status = res.status;
      statusText = res.statusText;
    } catch (e) {
      console.error(
        `  [net  ] ${label}: HEAD failed — ${
          e instanceof Error ? e.message : String(e)
        }`
      );
      bad++;
      continue;
    }

    const hostHint =
      host === expectedHost || host.endsWith(".supabase.co")
        ? ""
        : ` (host ${host} != ${expectedHost})`;

    if (status >= 200 && status < 300) {
      console.log(`  [OK   ] ${label}: ${status} ${statusText}${hostHint}`);
    } else {
      console.error(
        `  [HTTP ] ${label}: ${status} ${statusText}${hostHint} — ${img}`
      );
      if (status === 400) {
        console.error(
          "          400 from Supabase Storage usually means the bucket is private OR the SELECT policy is missing for `public`."
        );
      }
      if (status === 404) {
        console.error(
          "          404 means the object key is gone from the bucket — DB and Storage are out of sync."
        );
      }
      bad++;
    }
  }

  console.log(
    `\nDone. ${bad} issue(s) out of ${products.length} sampled product(s).`
  );
  if (bad > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error("Diagnostic crashed:", e);
  process.exit(1);
});

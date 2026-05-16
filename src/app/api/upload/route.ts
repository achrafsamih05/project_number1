import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { handle, httpError } from "@/lib/server/http";

// ---------------------------------------------------------------------------
// POST /api/upload — admin-only. Multipart form-data file upload that streams
// the file into the `product-images` Supabase Storage bucket and returns its
// public URL.
//
// Why server-side instead of client-side upload?
//   - The browser never sees the Supabase service-role key (only the server
//     has it). That key is required for reliable writes that bypass RLS.
//   - Admin gate stays consistent: every write in this app goes through
//     `getCurrentUser() + role === "admin"`.
//
// Request shape: multipart/form-data with a single `file` field.
// Response shape: { data: { url, path } } or { error }.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

// Cache the "bucket exists" check across invocations within the same Node
// process so we don't hit Storage on every upload.
const g = globalThis as unknown as { __novaUploadBucketReady?: boolean };

async function ensureBucket() {
  if (g.__novaUploadBucketReady) return;
  const sb = getSupabaseAdmin();
  // Try to fetch the bucket. If it doesn't exist, create it as public so the
  // returned getPublicUrl() actually serves the file.
  const { data, error } = await sb.storage.getBucket(BUCKET);
  if (data) {
    g.__novaUploadBucketReady = true;
    return;
  }
  // Not found (or permission issue). Try to create it.
  if (error) {
    const { error: createErr } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });
    if (createErr && !/already exists/i.test(createErr.message)) {
      throw new Error(
        `Could not ensure storage bucket "${BUCKET}": ${createErr.message}`
      );
    }
  }
  g.__novaUploadBucketReady = true;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

export const POST = (req: NextRequest) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      httpError(400, "Expected multipart/form-data");
    }

    const file = form!.get("file");
    if (!file || typeof file === "string") {
      httpError(400, "Missing file field");
    }

    const f = file as File;
    if (!ALLOWED_TYPES.has(f.type)) {
      httpError(400, `Unsupported file type: ${f.type || "unknown"}`);
    }
    if (f.size > MAX_BYTES) {
      httpError(400, `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`);
    }

    await ensureBucket();

    const ext = extFromMime(f.type);
    // Randomised key so concurrent uploads of the same filename don't collide.
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const bytes = new Uint8Array(await f.arrayBuffer());
    const sb = getSupabaseAdmin();
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(key, bytes, {
        contentType: f.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadErr) {
      // eslint-disable-next-line no-console
      console.error("[upload] Supabase Storage upload failed:", uploadErr);
      throw new Error(`Upload failed: ${uploadErr.message}`);
    }

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(key);
    const url = pub.publicUrl;

    // Defensive sanity check: getPublicUrl() should always return an absolute
    // https:// URL. If it doesn't, persisting the result would cause the
    // "broken icon everywhere" bug because the DB would hold a path fragment.
    // Log loudly so the failure is traceable server-side.
    if (!/^https?:\/\//i.test(url)) {
      // eslint-disable-next-line no-console
      console.error(
        `[upload] getPublicUrl() returned a non-absolute URL "${url}" for key ${key}. ` +
          "Storefront images will break. Check SUPABASE_URL and bucket visibility."
      );
    }

    return { url, path: key };
  });

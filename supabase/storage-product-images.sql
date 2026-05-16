-- ============================================================================
-- Supabase Storage: product-images bucket
--
-- Guarantees the `product-images` bucket exists, is PUBLIC, and has a SELECT
-- policy that allows anonymous reads. Without these three things the URL
-- returned by `supabase.storage.from('product-images').getPublicUrl(path)`
-- will 400 for everyone except the service-role, which is exactly the
-- "broken icon" bug.
--
-- Idempotent — safe to run multiple times. Run it in the Supabase SQL Editor.
-- ============================================================================

-- 1. Ensure the bucket exists and is public. `on conflict` lets us flip an
--    existing private bucket to public without manual clicks.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update
  set public = excluded.public;

-- 2. Public SELECT policy. Dropped first so re-running with a renamed policy
--    doesn't leave an orphan. The service_role bypasses RLS and doesn't
--    need a policy, but the anonymous browser fetch does.
drop policy if exists "Public read access to product-images"
  on storage.objects;

create policy "Public read access to product-images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- 3. (Optional) Tight INSERT/UPDATE/DELETE policies. Writes only go through
--    our server with the service-role key, which bypasses RLS — these exist
--    as a safety net if you ever expose the anon key for writes.
drop policy if exists "No public writes to product-images"
  on storage.objects;
-- No create policy for writes -> default-deny for anon/authenticated. 

-- 4. Quick verification. Run the two lines below after executing the script.
-- select id, name, public from storage.buckets where id = 'product-images';
-- select policyname, cmd, roles from pg_policies
--   where schemaname = 'storage' and tablename = 'objects';

-- ============================================================================
-- Nova e-commerce — products.images multi-image migration
--
-- Adds a text[] column `images` to public.products so a product can carry an
-- ordered gallery of image URLs instead of just one. Existing rows are
-- backfilled from the legacy single `image` column, so no data is lost.
--
-- Run this ONCE in your Supabase SQL Editor. Safe to re-run (every step is
-- idempotent).
-- ============================================================================

-- 1. Add the column as text[] with a safe default of empty array. The NOT
--    NULL constraint + default means every existing row gets `{}` and all
--    future INSERTs work without having to know about the new column.
alter table public.products
  add column if not exists images text[] not null default '{}';

-- 2. Backfill. For any row whose `images` is still empty but `image` is set,
--    seed the array with that single URL. This is what productFromRow()
--    already does at read time — we persist it so queries that touch
--    `images` directly (analytics, reports) see consistent data.
update public.products
   set images = array[image]
 where (images is null or cardinality(images) = 0)
   and image is not null
   and length(trim(image)) > 0;

-- 3. Keep the legacy `image` column in sync going forward. A BEFORE INSERT
--    OR UPDATE trigger fills the "other side" so:
--      - Writing only `images[]` (new code path) auto-populates `image`
--        with `images[1]` — keeping `NOT NULL` rows valid without app-side
--        duplication.
--      - Writing only `image` (legacy clients) auto-populates `images`
--        with `array[image]` — so the new UI can always rely on the array.
create or replace function public.products_sync_image_cover()
returns trigger
language plpgsql
as $$
begin
  -- If images[] was given non-empty and image is blank/null, mirror the cover.
  if (new.images is not null and cardinality(new.images) > 0)
     and (new.image is null or length(trim(new.image)) = 0)
  then
    new.image := new.images[1];
  end if;

  -- If image is given and images[] is empty/null, mirror it into the array.
  if (new.image is not null and length(trim(new.image)) > 0)
     and (new.images is null or cardinality(new.images) = 0)
  then
    new.images := array[new.image];
  end if;

  return new;
end;
$$;

drop trigger if exists products_sync_image_cover on public.products;
create trigger products_sync_image_cover
  before insert or update on public.products
  for each row execute function public.products_sync_image_cover();

-- 4. Quick verification. After running the script, these SELECTs should all
--    return rows / non-zero counts.
select 'products.images column'        as check,
       count(*) filter (where column_name = 'images') as exists
  from information_schema.columns
 where table_schema = 'public' and table_name = 'products';

select 'rows with populated images[]'  as check,
       count(*) as rows
  from public.products
 where cardinality(images) > 0;

-- ============================================================================
-- Nova e-commerce — settings table footer/contact migration.
--
-- PURPOSE
--   Adds the store-contact + social-media fields that back the dynamic
--   storefront footer. These are the EXACT fields the storefront <Footer />
--   component and the admin Settings form read/write:
--
--     contact_email      Store-wide contact address (mailto: link)
--     contact_phone      Store-wide phone number    (tel: link)
--     address            Physical address, free text, used in the footer
--     facebook_url       https://facebook.com/...
--     instagram_url      https://instagram.com/...
--     twitter_url        https://twitter.com/... (or X)
--     youtube_url        https://youtube.com/...
--     linkedin_url       https://linkedin.com/...
--     tiktok_url         https://tiktok.com/...
--     footer_tagline     Short marketing sentence shown under the store name
--
-- SAFETY
--   Run this in the Supabase SQL editor (or psql) against any existing
--   database. It ONLY adds columns — no DROP, no TRUNCATE, no data loss:
--     - every ALTER uses `add column if not exists`, so re-running is a no-op
--     - existing rows keep every previous value (store_name, currency, etc.)
--     - defaults are empty strings so the app doesn't have to branch on NULL
--   You do NOT need to re-seed or re-run schema.sql / align.sql after this.
-- ============================================================================

alter table public.settings
  add column if not exists contact_email   text not null default '',
  add column if not exists contact_phone   text not null default '',
  add column if not exists address         text not null default '',
  add column if not exists facebook_url    text not null default '',
  add column if not exists instagram_url   text not null default '',
  add column if not exists twitter_url     text not null default '',
  add column if not exists youtube_url     text not null default '',
  add column if not exists linkedin_url    text not null default '',
  add column if not exists tiktok_url      text not null default '',
  add column if not exists footer_tagline  text not null default '';

-- Ensure the single settings row exists (same guard as schema.sql).
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Verification: every row returned should equal 1 (column present).
select 'settings new columns' as check,
       count(*) filter (where column_name = 'contact_email')  as has_contact_email,
       count(*) filter (where column_name = 'contact_phone')  as has_contact_phone,
       count(*) filter (where column_name = 'address')        as has_address,
       count(*) filter (where column_name = 'facebook_url')   as has_facebook_url,
       count(*) filter (where column_name = 'instagram_url')  as has_instagram_url,
       count(*) filter (where column_name = 'twitter_url')    as has_twitter_url,
       count(*) filter (where column_name = 'youtube_url')    as has_youtube_url,
       count(*) filter (where column_name = 'linkedin_url')   as has_linkedin_url,
       count(*) filter (where column_name = 'tiktok_url')     as has_tiktok_url,
       count(*) filter (where column_name = 'footer_tagline') as has_footer_tagline
  from information_schema.columns
 where table_schema = 'public' and table_name = 'settings';

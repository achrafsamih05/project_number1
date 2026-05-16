-- ============================================================================
-- Nova e-commerce — schema alignment script.
--
-- Run this ONCE in your Supabase project (SQL Editor → paste → Run). It is
-- safe to re-run: every CREATE and ALTER is guarded with IF NOT EXISTS and
-- every policy is dropped-then-created so reruns are idempotent.
--
-- What this script guarantees when it finishes:
--   1. users / categories / products / orders / order_items / invoices /
--      settings tables exist with the exact column names the app expects.
--   2. Any pre-existing tables get missing columns added (password_hash,
--      last_seen_at, postal_code, …) without losing data.
--   3. RLS is enabled on every table; anon gets read-only on the catalog +
--      settings, nothing else. All writes go through the service-role key,
--      which bypasses RLS.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------------

do $$ begin
  create type order_status as enum
    ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('paid', 'unpaid', 'overdue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('customer', 'admin');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------
-- 2. CATEGORIES
-- ------------------------------------------------------------------

create table if not exists public.categories (
  id         text primary key,
  slug       text not null unique,
  name_en    text not null,
  name_ar    text not null,
  name_fr    text not null,
  icon       text not null,
  created_at timestamptz not null default now()
);

-- If the table pre-existed with older column names, add the expected ones.
alter table public.categories
  add column if not exists slug       text,
  add column if not exists name_en    text,
  add column if not exists name_ar    text,
  add column if not exists name_fr    text,
  add column if not exists icon       text,
  add column if not exists created_at timestamptz default now();

-- ------------------------------------------------------------------
-- 3. PRODUCTS
-- ------------------------------------------------------------------

create table if not exists public.products (
  id              text primary key,
  sku             text not null unique,
  name_en         text not null,
  name_ar         text not null,
  name_fr         text not null,
  description_en  text not null default '',
  description_ar  text not null default '',
  description_fr  text not null default '',
  price           numeric(12, 2) not null check (price >= 0),
  category_id     text not null references public.categories(id) on delete restrict,
  stock           integer not null default 0 check (stock >= 0),
  image           text not null,
  rating          numeric(3, 2) not null default 0 check (rating between 0 and 5),
  created_at      timestamptz not null default now()
);

alter table public.products
  add column if not exists sku             text,
  add column if not exists name_en         text,
  add column if not exists name_ar         text,
  add column if not exists name_fr         text,
  add column if not exists description_en  text default '',
  add column if not exists description_ar  text default '',
  add column if not exists description_fr  text default '',
  add column if not exists price           numeric(12, 2),
  -- Cost-of-goods column. Powers the admin "Expenses & Profits" view.
  -- Defaults to 0 so existing rows behave as "not priced yet" instead of
  -- breaking aggregates with NULL.
  add column if not exists purchase_price  numeric(12, 2) default 0,
  add column if not exists category_id     text,
  add column if not exists stock           integer default 0,
  add column if not exists image           text,
  add column if not exists images          text[] default '{}',
  add column if not exists rating          numeric(3, 2) default 0,
  add column if not exists created_at      timestamptz default now();

-- Belt-and-braces: even if the column already existed without a default,
-- backfill any NULLs with 0 so the NOT NULL constraint that schema.sql
-- declares can be enforced safely on a re-run.
update public.products set purchase_price = 0 where purchase_price is null;

-- Backfill images[] from the legacy single-URL `image` column for any row
-- that pre-existed before the multi-image migration. Idempotent: a row
-- that already has entries is skipped.
update public.products
   set images = array[image]
 where (images is null or cardinality(images) = 0)
   and image is not null
   and length(trim(image)) > 0;

-- Keep image cover ↔ images[1] consistent on every write. See
-- supabase/multi-image-migration.sql for the full rationale.
create or replace function public.products_sync_image_cover()
returns trigger
language plpgsql
as $$
begin
  if (new.images is not null and cardinality(new.images) > 0)
     and (new.image is null or length(trim(new.image)) = 0)
  then
    new.image := new.images[1];
  end if;
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

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_created_at_idx  on public.products (created_at desc);

-- ------------------------------------------------------------------
-- 4. USERS
-- ------------------------------------------------------------------

create table if not exists public.users (
  id             text primary key,
  email          text not null unique,
  name           text not null,
  role           user_role not null default 'customer',
  phone          text,
  address        text,
  city           text,
  postal_code    text,
  country        text,
  banned         boolean not null default false,
  password_hash  text not null,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz
);

-- Forward-compatibility for older users tables (e.g. ones that used
-- `password` or `full_name` before):
alter table public.users
  add column if not exists name          text,
  add column if not exists role          user_role default 'customer',
  add column if not exists phone         text,
  add column if not exists address       text,
  add column if not exists city          text,
  add column if not exists postal_code   text,
  add column if not exists country       text,
  add column if not exists banned        boolean default false,
  add column if not exists password_hash text,
  add column if not exists created_at    timestamptz default now(),
  add column if not exists last_seen_at  timestamptz;

-- If an older table has `full_name` but no `name`, copy the data across.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'full_name'
  ) then
    update public.users set name = full_name where name is null;
  end if;
end $$;

-- Same story for `password` → `password_hash`.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'password'
  ) then
    update public.users set password_hash = password where password_hash is null;
  end if;
end $$;

create index if not exists users_role_idx on public.users (role);

-- ------------------------------------------------------------------
-- 5. ORDERS + ORDER_ITEMS
-- ------------------------------------------------------------------

create table if not exists public.orders (
  id                text primary key,
  user_id           text references public.users(id) on delete set null,
  customer_name     text not null,
  customer_email    text,
  customer_phone    text not null,
  customer_address  text not null,
  subtotal          numeric(12, 2) not null,
  tax               numeric(12, 2) not null,
  total             numeric(12, 2) not null,
  status            order_status not null default 'pending',
  created_at        timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status);
create index if not exists orders_user_id_idx    on public.orders (user_id);

create table if not exists public.order_items (
  id          bigserial primary key,
  order_id    text not null references public.orders(id) on delete cascade,
  product_id  text not null references public.products(id) on delete restrict,
  name        text not null,
  quantity    integer not null check (quantity > 0),
  price       numeric(12, 2) not null
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ------------------------------------------------------------------
-- 6. INVOICES
-- ------------------------------------------------------------------

create table if not exists public.invoices (
  id         text primary key,
  order_id   text not null references public.orders(id) on delete cascade,
  number     text not null unique,
  issued_at  timestamptz not null default now(),
  due_at     timestamptz not null,
  status     invoice_status not null default 'unpaid',
  amount     numeric(12, 2) not null
);
create index if not exists invoices_status_idx   on public.invoices (status);
create index if not exists invoices_order_id_idx on public.invoices (order_id);

-- ------------------------------------------------------------------
-- 7. SETTINGS (single-row table, pk = 1)
-- ------------------------------------------------------------------

create table if not exists public.settings (
  id                   int primary key default 1 check (id = 1),
  store_name           text not null default 'Nova',
  currency             text not null default 'USD',
  tax_rate             numeric(5, 2) not null default 10,
  low_stock_threshold  integer not null default 20
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ============================================================================
-- ROW-LEVEL SECURITY
--
-- The API layer does all authorization in application code via signed session
-- cookies (see src/middleware.ts + getCurrentUser() in src/lib/server/auth.ts).
-- Every mutation goes through the service-role key, which bypasses RLS.
--
-- So the RLS policy is the safe minimum:
--   - public SELECT on products, categories, settings  (storefront)
--   - nothing for everyone else; reads to users / orders / invoices only work
--     with the service-role key
-- ============================================================================

alter table public.products    enable row level security;
alter table public.categories  enable row level security;
alter table public.settings    enable row level security;
alter table public.users       enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices    enable row level security;

drop policy if exists "Public read products"   on public.products;
drop policy if exists "Public read categories" on public.categories;
drop policy if exists "Public read settings"   on public.settings;

create policy "Public read products"   on public.products   for select using (true);
create policy "Public read categories" on public.categories for select using (true);
create policy "Public read settings"   on public.settings   for select using (true);

-- No policies for users / orders / order_items / invoices — with RLS on and
-- no policies, the anon key gets nothing, which is exactly right because all
-- writes and authenticated reads go through the service-role client in
-- src/lib/server/db.ts.

-- ============================================================================
-- SEED (only inserts if the table is empty — safe to re-run)
-- ============================================================================

insert into public.categories (id, slug, name_en, name_ar, name_fr, icon)
select * from (values
  ('c-electronics', 'electronics', 'Electronics', 'إلكترونيات', 'Électronique', 'Cpu'),
  ('c-phones',      'phones',      'Phones',      'هواتف',      'Téléphones',  'Smartphone'),
  ('c-plumbing',    'plumbing',    'Plumbing',    'سباكة',      'Plomberie',   'Wrench'),
  ('c-home',        'home',        'Home',        'المنزل',     'Maison',      'Sofa'),
  ('c-fashion',     'fashion',     'Fashion',     'أزياء',      'Mode',        'Shirt'),
  ('c-sports',      'sports',      'Sports',      'رياضة',      'Sport',       'Dumbbell')
) as v(id, slug, name_en, name_ar, name_fr, icon)
on conflict (id) do nothing;

-- ============================================================================
-- FOREIGN KEY ALIGNMENT
--
-- The original schema used ON DELETE RESTRICT / SET NULL for several FKs that
-- now need ON DELETE CASCADE so admins can actually remove a product or a
-- user without the database raising 23503 errors.
--
-- Rules:
--   - products.category_id     -> categories(id)   ON DELETE CASCADE
--   - order_items.product_id   -> products(id)     ON DELETE CASCADE
--   - orders.user_id           -> users(id)        ON DELETE CASCADE
--   - order_items.order_id     -> orders(id)       ON DELETE CASCADE   (already)
--   - invoices.order_id        -> orders(id)       ON DELETE CASCADE   (already)
--
-- We discover the existing constraint name dynamically (Postgres often picks
-- "<table>_<column>_fkey") and replace it. Wrapped in DO blocks so the script
-- stays idempotent: re-running is a no-op once the constraints are correct.
-- ============================================================================

do $$
declare
  cname text;
begin
  -- products.category_id -> categories(id)
  select tc.constraint_name into cname
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
       on tc.constraint_name = kcu.constraint_name
      and tc.table_schema    = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name   = 'products'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'category_id'
  limit 1;
  if cname is not null then
    execute format('alter table public.products drop constraint %I', cname);
  end if;
  alter table public.products
    add constraint products_category_id_fkey
    foreign key (category_id) references public.categories(id) on delete cascade;
end $$;

do $$
declare
  cname text;
begin
  -- order_items.product_id -> products(id)
  select tc.constraint_name into cname
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
       on tc.constraint_name = kcu.constraint_name
      and tc.table_schema    = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name   = 'order_items'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'product_id'
  limit 1;
  if cname is not null then
    execute format('alter table public.order_items drop constraint %I', cname);
  end if;
  alter table public.order_items
    add constraint order_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete cascade;
end $$;

do $$
declare
  cname text;
begin
  -- orders.user_id -> users(id)
  select tc.constraint_name into cname
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
       on tc.constraint_name = kcu.constraint_name
      and tc.table_schema    = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name   = 'orders'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'user_id'
  limit 1;
  if cname is not null then
    execute format('alter table public.orders drop constraint %I', cname);
  end if;
  alter table public.orders
    add constraint orders_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade;
end $$;

-- ============================================================================
-- ORDERS COLUMN ALIGNMENT (checkout refactor)
--
-- customer_email is now OPTIONAL (guests can place orders with just a phone).
-- customer_phone is now REQUIRED (primary identifier for guest orders).
-- Safe to re-run: ALTER COLUMN ... DROP NOT NULL is idempotent in Postgres
-- (no error if the column is already nullable).
-- ============================================================================

alter table public.orders alter column customer_email drop not null;
alter table public.orders alter column customer_phone set not null;

-- Backfill: any existing rows with NULL phone get an empty-string placeholder
-- so the NOT NULL constraint can be enforced. A truly NULL phone on a legacy
-- row means the data was never collected — '' is the least-disruptive fix.
update public.orders set customer_phone = '' where customer_phone is null;


select 'users columns'      as check,
       count(*) filter (where column_name = 'name')           as has_name,
       count(*) filter (where column_name = 'password_hash')  as has_password_hash
  from information_schema.columns
 where table_schema = 'public' and table_name = 'users';

select 'categories columns' as check,
       count(*) filter (where column_name = 'name_en') as has_name_en,
       count(*) filter (where column_name = 'slug')    as has_slug
  from information_schema.columns
 where table_schema = 'public' and table_name = 'categories';

select 'products columns'   as check,
       count(*) filter (where column_name = 'name_en')     as has_name_en,
       count(*) filter (where column_name = 'category_id') as has_category_id,
       count(*) filter (where column_name = 'images')      as has_images
  from information_schema.columns
 where table_schema = 'public' and table_name = 'products';

select 'settings row'       as check,
       count(*)             as rows
  from public.settings where id = 1;

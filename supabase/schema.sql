-- ===========================================================================
-- Nova e-commerce — Supabase / PostgreSQL schema
--
-- Run this ONCE in your Supabase project (SQL Editor → New query → paste → Run).
-- Safe to re-run: every CREATE is guarded with IF NOT EXISTS and every INSERT
-- uses ON CONFLICT DO NOTHING.
-- ===========================================================================

-- ---- Enums ----------------------------------------------------------------

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

-- ---- categories -----------------------------------------------------------

create table if not exists public.categories (
  id         text primary key,
  slug       text not null unique,
  name_en    text not null,
  name_ar    text not null,
  name_fr    text not null,
  icon       text not null,
  created_at timestamptz not null default now()
);

-- ---- products -------------------------------------------------------------

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
  -- Cost-of-goods price. Drives the admin "Expenses & Profits" view:
  --   capital_tied = sum(purchase_price * stock)
  --   projected_profit = sum((price - purchase_price) * stock)
  -- Defaults to 0 so legacy rows that haven't been priced yet simply
  -- contribute zero to the margin calculation rather than NULL-poisoning
  -- the aggregates.
  purchase_price  numeric(12, 2) not null default 0 check (purchase_price >= 0),
  category_id     text not null references public.categories(id) on delete cascade,
  stock           integer not null default 0 check (stock >= 0),
  -- Legacy cover image. Kept for backward compatibility with older clients
  -- that still read `image`. The `products_sync_image_cover` trigger below
  -- keeps this in sync with `images[1]`.
  image           text not null,
  -- Canonical multi-image gallery. Every new product carries an ordered
  -- array of URLs; element 0 is the cover.
  images          text[] not null default '{}',
  rating          numeric(3, 2) not null default 0 check (rating between 0 and 5),
  created_at      timestamptz not null default now()
);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_created_at_idx  on public.products (created_at desc);

-- Keep the `image` cover and the `images[]` gallery in sync on every write.
-- See supabase/multi-image-migration.sql for the full rationale. Replicated
-- here so a brand-new project gets the same behaviour from day one.
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

-- ---- users ----------------------------------------------------------------

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
create index if not exists users_role_idx on public.users (role);

-- ---- settings (single-row table) ------------------------------------------

create table if not exists public.settings (
  id                   int primary key default 1 check (id = 1),
  store_name           text not null default 'Nova',
  currency             text not null default 'USD',
  tax_rate             numeric(5, 2) not null default 10,
  low_stock_threshold  integer not null default 20
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---- orders + order_items -------------------------------------------------

create table if not exists public.orders (
  id                text primary key,
  user_id           text references public.users(id) on delete cascade,
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
  product_id  text not null references public.products(id) on delete cascade,
  name        text not null,
  quantity    integer not null check (quantity > 0),
  price       numeric(12, 2) not null
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ---- invoices -------------------------------------------------------------

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

-- ===========================================================================
-- Row-Level Security
--
-- Nova's API layer already enforces authorization via signed session cookies
-- (see src/middleware.ts and getCurrentUser in src/lib/server/auth.ts).
-- All writes go through the service-role key, which bypasses RLS anyway.
--
-- To make anon reads safe (products, categories, settings) while blocking
-- the raw anon key from reading users/orders, you can flip RLS on with:
-- ===========================================================================

alter table public.products    enable row level security;
alter table public.categories  enable row level security;
alter table public.settings    enable row level security;
alter table public.users       enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices    enable row level security;

-- Public read on catalog + store config
drop policy if exists "Public read products"   on public.products;
drop policy if exists "Public read categories" on public.categories;
drop policy if exists "Public read settings"   on public.settings;

create policy "Public read products"   on public.products   for select using (true);
create policy "Public read categories" on public.categories for select using (true);
create policy "Public read settings"   on public.settings   for select using (true);

-- users / orders / order_items / invoices are all accessed exclusively via
-- the service-role client in src/lib/server/db.ts, so no anon policies are
-- needed — the default "no policy = no access for anon" is exactly right.

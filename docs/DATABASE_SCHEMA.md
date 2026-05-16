# Database Schema

Nova is designed to run on a real relational database (PostgreSQL / Supabase) in production.
In the reference implementation, persistence is Supabase (PostgreSQL) via the `@supabase/supabase-js` client in `src/lib/server/db.ts`. Swap providers by replacing that file — the route handlers don't change.

## Schema overview

```
users ─┐
       ├── orders ─┬── order_items
       │          └── invoices
categories ─── products
settings (single row)
```

## Tables

### `categories`

```sql
create table categories (
  id         text primary key,           -- e.g. c-electronics
  slug       text not null unique,
  name_en    text not null,
  name_ar    text not null,
  name_fr    text not null,
  icon       text not null,              -- lucide icon name
  created_at timestamptz not null default now()
);
```

### `products`

```sql
create table products (
  id              text primary key,
  sku             text not null unique,
  name_en         text not null,
  name_ar         text not null,
  name_fr         text not null,
  description_en  text not null default '',
  description_ar  text not null default '',
  description_fr  text not null default '',
  price           numeric(12, 2) not null check (price >= 0),
  currency        text not null default 'USD',
  category_id     text not null references categories(id) on delete restrict,
  stock           integer not null default 0 check (stock >= 0),
  -- Legacy single cover URL. Kept for backward compatibility; the
  -- `products_sync_image_cover` BEFORE trigger keeps it in sync with
  -- `images[1]` on every write.
  image           text not null,
  -- Canonical multi-image gallery. Element 0 is the cover. All new code
  -- paths (admin inventory, Quick View modal, product page) read from
  -- this column.
  images          text[] not null default '{}',
  rating          numeric(3, 2) not null default 0 check (rating between 0 and 5),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on products (category_id);
create index on products (created_at desc);
```

> **Migration:** existing projects can pick up the `images text[]` column via
> `supabase/multi-image-migration.sql`. The script is idempotent: it adds the
> column, backfills it from the legacy `image` column, and installs the
> `products_sync_image_cover` trigger that keeps the two in sync thereafter.

### `users`

```sql
create type user_role as enum ('customer', 'admin');

create table users (
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
  password_hash  text not null,      -- scrypt: "<saltHex>$<hashHex>"
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz
);
create index on users (role);
create index on users (banned);
```

### `settings`

```sql
-- Single-row key/value is fine too; this shape keeps it trivially readable.
create table settings (
  id                   int primary key default 1 check (id = 1),
  store_name           text not null default 'Nova',
  currency             text not null default 'USD',
  tax_rate             numeric(5, 2) not null default 10,    -- percent
  low_stock_threshold  integer not null default 20
);
insert into settings default values on conflict do nothing;
```

### `orders`

```sql
create type order_status as enum (
  'pending', 'processing', 'shipped', 'delivered', 'cancelled'
);

create table orders (
  id                text primary key,
  user_id           text references users(id) on delete set null, -- nullable for guest orders
  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text,
  customer_address  text not null,
  subtotal          numeric(12, 2) not null,
  tax               numeric(12, 2) not null,
  total             numeric(12, 2) not null,
  status            order_status not null default 'pending',
  created_at        timestamptz not null default now()
);
create index on orders (created_at desc);
create index on orders (status);
create index on orders (user_id);
```

### `order_items`

```sql
create table order_items (
  id          bigserial primary key,
  order_id    text not null references orders(id) on delete cascade,
  product_id  text not null references products(id) on delete restrict,
  name        text not null,
  quantity    integer not null check (quantity > 0),
  price       numeric(12, 2) not null
);
create index on order_items (order_id);
```

### `invoices`

```sql
create type invoice_status as enum ('paid', 'unpaid', 'overdue');

create table invoices (
  id         text primary key,
  order_id   text not null references orders(id) on delete cascade,
  number     text not null unique,
  issued_at  timestamptz not null default now(),
  due_at     timestamptz not null,
  status     invoice_status not null default 'unpaid',
  amount     numeric(12, 2) not null
);
create index on invoices (status);
create index on invoices (order_id);
```

## Realtime

The demo emits mutation events over Server-Sent Events (`/api/events`). In production:

- **Supabase**: enable Realtime on `products`, `categories`, `orders`, `invoices`, `users`, `settings` and subscribe per-channel from the client hooks in `src/lib/client/hooks.ts`.
- **Postgres**: use `LISTEN / NOTIFY` with a `pg_notify` trigger for each of the tables above.
- **Firestore**: use document snapshots on the same collections.

The client fan-out is already built in `src/lib/client/realtime.ts` — swap the EventSource source and the rest of the app stays the same.

## Seed

`src/lib/server/db.ts` seeds:

- 6 categories · 12 products · 2 sample orders · 2 invoices
- A demo admin (`admin@nova.shop` / `admin1234`) and a demo customer (`demo@nova.shop` / `demo1234`) — rotate these immediately after first run.

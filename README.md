# Nova — Modern E-commerce

A production-grade e-commerce reference built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Zustand**. Multilingual storefront (EN / AR / FR with RTL) + full admin dashboard + real authentication, real analytics, and real-time sync.

## What's inside

- **Storefront**
  - Floating glass toolbar, language switcher, floating cart FAB, mobile bottom nav
  - Instant category chips and live URL-synced search
  - Side-drawer cart (no page reloads) with quantity controls
  - **One-click checkout** for logged-in users using their saved shipping profile
  - Storefront prices/name update instantly when the admin changes them
- **Auth / authorization**
  - Customer sign-in at `/login` and **separate admin sign-in at `/login/admin`**
  - Edge middleware gates `/admin/*` and admin APIs on role
  - scrypt password hashing + HMAC-signed session cookies (Web-Crypto compatible for middleware)
  - Banned accounts are rejected on next request
- **Admin**
  - **Real analytics** — revenue (paid invoices), orders, active users, stock alerts, 14-day revenue chart, top products, status breakdown
  - Inventory CRUD with multilingual product editor
  - Orders with inline status updates and expandable detail
  - Invoices with paid/unpaid toggle + printable modal
  - **Users page** with ban/unban and delete
  - **Global Settings** — store name, currency, tax rate, low-stock threshold — applied site-wide
- **Realtime**
  - In-process event bus → `/api/events` Server-Sent Events stream
  - Client hooks subscribe once and auto-refetch; every admin mutation is visible on every open tab

## Running

```bash
# 1) Install deps
npm install

# 2) Set up Supabase (one-time)
#    - Create a project on https://supabase.com
#    - SQL Editor → paste supabase/schema.sql → Run
#    - Copy SUPABASE_URL, anon key, and service-role key into .env.local
cp .env.example .env.local   # fill in the values

# 3) Seed the database (12 products, 2 users, settings, etc.)
npm run seed

# 4) Start
npm run dev        # storefront http://localhost:3000 · admin http://localhost:3000/admin
```

**Seed accounts** (change immediately):
- Admin: `admin@nova.shop` / `admin1234`
- Customer: `demo@nova.shop` / `demo1234`

**Environment variables** (required — set these locally *and* in Vercel):
| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Anon key for public reads (products, categories, settings) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** — every admin write and order creation goes through this, bypassing RLS |
| `NEXTAUTH_SECRET` | HMAC key for session cookies. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

> **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser — it bypasses RLS. In Vercel, scope it to *Production + Preview + Development* but never prefix with `NEXT_PUBLIC_`.

## Deploying to Vercel

1. Push this branch to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
2. Framework preset is auto-detected as **Next.js**. Leave build command and output defaults alone.
3. **Project Settings → Environment Variables**, add the four variables above for every environment (Production, Preview, Development).
4. Deploy.
5. After the first deploy, run `npm run seed` locally once against the same Supabase project (the seed script uses your `.env.local`). The site will then show 12 products + working admin login.

Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `seed`.

## Project structure

```
src/
  app/
    layout.tsx · page.tsx · categories/ · cart/ · checkout/ · account/
    login/  login/admin/  register/                -- auth flows
    admin/
      page.tsx  inventory/  orders/  invoices/  users/  settings/
    api/
      auth/{login, logout, register, me}/          -- session + profile
      products/[id]  categories  orders/[id]  invoices/[id]
      users/[id]  settings  analytics  events      -- SSE realtime
  components/
    ui/{Button, Icon}
    auth/AuthLayout
    storefront/{Toolbar, UserMenu, CartDrawer, ...}
    admin/AdminShell
  lib/
    server/{db, auth, bus}.ts                      -- server-only
    client/{api, hooks, realtime}.ts               -- client-only
    store/{cart, locale}.ts                        -- Zustand
    types.ts  i18n.ts  useI18n.ts  format.ts  utils.ts
  middleware.ts                                    -- Edge: /admin/* gate
```

## Key design notes

- **Persistence** is Supabase (PostgreSQL) via `@supabase/supabase-js` in `src/lib/server/db.ts`. Works on Vercel with no filesystem writes. Swap providers by replacing that file — route handlers stay the same.
- **Realtime** uses an in-process `EventEmitter` → SSE. To scale horizontally, swap for Redis pub/sub, Postgres `LISTEN/NOTIFY`, or Supabase Realtime; the client contract (`/api/events`) stays the same.
- **Authorization** is layered: Edge middleware for page/routes that never need per-method logic, and `getCurrentUser()` checks inside routes (orders, invoices, settings) for fine-grained rules.
- **RTL** is done via logical CSS (`start-*`/`end-*`, `ps-*`/`pe-*`). `useI18n` syncs `<html dir/lang>`; the cart drawer mirrors its slide direction automatically.

## Docs

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — component/state map
- [`docs/API_ENDPOINTS.md`](./docs/API_ENDPOINTS.md) — every endpoint with auth rules
- [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) — full SQL schema ready for Supabase/Postgres

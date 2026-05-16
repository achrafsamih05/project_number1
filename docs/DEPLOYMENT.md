# Nova Commerce OS — Deployment & Operations Guide

> **Platform:** Next.js 14 + Supabase (PostgreSQL) Multi-Tenant SaaS  
> **Version:** Post-Phase 5 (All features merged)  
> **Target:** Vercel Edge + Supabase Cloud

---

## Table of Contents

1. [Database Provisioning & SQL Scripts](#1-database-provisioning--sql-scripts)
2. [Environment Variables Manifest](#2-environment-variables-manifest)
3. [Build & Deployment Commands](#3-build--deployment-commands)
4. [Post-Deployment Verification Checklist](#4-post-deployment-verification-checklist)

---

## 1. Database Provisioning & SQL Scripts

Execute these scripts **sequentially** in the Supabase SQL Editor (`Dashboard → SQL Editor → New Query`). Each block is idempotent — safe to re-run.

### 1.1 — Base Schema (Run First if Fresh DB)

> If your Supabase project already has the base tables from the seed script, skip to 1.2.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- BASE SCHEMA: Core tables (categories, products, users, orders, settings)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS categories (
  id         text PRIMARY KEY,
  slug       text NOT NULL UNIQUE,
  name_en    text NOT NULL,
  name_ar    text NOT NULL DEFAULT '',
  name_fr    text NOT NULL DEFAULT '',
  icon       text NOT NULL DEFAULT 'LayoutGrid',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id              text PRIMARY KEY,
  sku             text NOT NULL UNIQUE,
  name_en         text NOT NULL,
  name_ar         text NOT NULL DEFAULT '',
  name_fr         text NOT NULL DEFAULT '',
  description_en  text NOT NULL DEFAULT '',
  description_ar  text NOT NULL DEFAULT '',
  description_fr  text NOT NULL DEFAULT '',
  price           numeric(12,2) NOT NULL CHECK (price >= 0),
  purchase_price  numeric(12,2) NOT NULL DEFAULT 0,
  category_id     text NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  stock           integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image           text NOT NULL DEFAULT '',
  images          text[] NOT NULL DEFAULT '{}',
  rating          numeric(3,2) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id             text PRIMARY KEY,
  email          text NOT NULL UNIQUE,
  name           text NOT NULL,
  role           text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  phone          text,
  address        text,
  city           text,
  postal_code    text,
  country        text,
  banned         boolean NOT NULL DEFAULT false,
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz
);

CREATE TABLE IF NOT EXISTS settings (
  id                   serial PRIMARY KEY,
  store_name           text NOT NULL DEFAULT 'Nova',
  currency             text NOT NULL DEFAULT 'USD',
  tax_rate             numeric(5,2) NOT NULL DEFAULT 10,
  low_stock_threshold  integer NOT NULL DEFAULT 20,
  contact_email        text NOT NULL DEFAULT '',
  contact_phone        text NOT NULL DEFAULT '',
  address              text NOT NULL DEFAULT '',
  footer_tagline       text NOT NULL DEFAULT '',
  facebook_url         text NOT NULL DEFAULT '',
  instagram_url        text NOT NULL DEFAULT '',
  twitter_url          text NOT NULL DEFAULT '',
  youtube_url          text NOT NULL DEFAULT '',
  linkedin_url         text NOT NULL DEFAULT '',
  tiktok_url           text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS orders (
  id                text PRIMARY KEY,
  user_id           text REFERENCES users(id) ON DELETE SET NULL,
  customer_name     text NOT NULL,
  customer_email    text,
  customer_phone    text NOT NULL DEFAULT '',
  customer_address  text NOT NULL,
  subtotal          numeric(12,2) NOT NULL,
  tax               numeric(12,2) NOT NULL,
  total             numeric(12,2) NOT NULL,
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id          bigserial PRIMARY KEY,
  order_id    text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  text NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  name        text NOT NULL,
  quantity    integer NOT NULL CHECK (quantity > 0),
  price       numeric(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id         text PRIMARY KEY,
  order_id   text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  number     text NOT NULL UNIQUE,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  due_at     timestamptz NOT NULL,
  status     text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid','unpaid','overdue')),
  amount     numeric(12,2) NOT NULL
);

-- Insert default settings row
INSERT INTO settings DEFAULT VALUES ON CONFLICT DO NOTHING;
```

### 1.2 — Migration 001: Multi-Tenant stores + store_id injection

```sql
-- Creates `stores` table and adds store_id FK to all resource tables.
-- Backfills existing data to a default store UUID.

CREATE TABLE IF NOT EXISTS stores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL,
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  custom_domain text UNIQUE,
  logo_url      text,
  status        text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'onboarding')),
  plan          text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_custom_domain ON stores(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- Default store (backfill target)
INSERT INTO stores (id, owner_id, name, slug, status, plan)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Nova (Default Store)',
  'nova-default',
  'active',
  'enterprise'
)
ON CONFLICT (id) DO NOTHING;

-- Add store_id to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE;
UPDATE products SET store_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE store_id IS NULL;
ALTER TABLE products ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

-- Add store_id to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE;
UPDATE categories SET store_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE store_id IS NULL;
ALTER TABLE categories ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);

-- Add store_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE;
UPDATE orders SET store_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE store_id IS NULL;
ALTER TABLE orders ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);

-- Add store_id to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE;
UPDATE invoices SET store_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE store_id IS NULL;
ALTER TABLE invoices ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_store_id ON invoices(store_id);

-- Add store_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE;
UPDATE users SET store_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE store_id IS NULL;
ALTER TABLE users ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);

-- Transform settings to per-store
DO $$ BEGIN ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_id_check; EXCEPTION WHEN undefined_object THEN NULL; END $$;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE;
UPDATE settings SET store_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE store_id IS NULL;
ALTER TABLE settings ALTER COLUMN store_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_store_id ON settings(store_id);

-- RLS helper function
CREATE OR REPLACE FUNCTION get_user_store_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM stores WHERE owner_id = auth.uid() LIMIT 1;
$$;
```

### 1.3 — Migration 002: Row Level Security (RLS)

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Stores: public read for active, owner full control
CREATE POLICY stores_select_public ON stores FOR SELECT USING (status = 'active');
CREATE POLICY stores_all_owner ON stores FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Products: public read, owner CRUD
CREATE POLICY products_select_public ON products FOR SELECT USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.status = 'active'));
CREATE POLICY products_all_owner ON products FOR ALL USING (store_id = get_user_store_id()) WITH CHECK (store_id = get_user_store_id());

-- Categories: public read, owner CRUD
CREATE POLICY categories_select_public ON categories FOR SELECT USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = categories.store_id AND stores.status = 'active'));
CREATE POLICY categories_all_owner ON categories FOR ALL USING (store_id = get_user_store_id()) WITH CHECK (store_id = get_user_store_id());

-- Orders: owner full, customer read own
CREATE POLICY orders_all_owner ON orders FOR ALL USING (store_id = get_user_store_id()) WITH CHECK (store_id = get_user_store_id());
CREATE POLICY orders_select_customer ON orders FOR SELECT USING (user_id IN (SELECT id FROM users WHERE users.id = auth.uid()::text) AND store_id IN (SELECT store_id FROM users WHERE users.id = auth.uid()::text));
CREATE POLICY orders_insert_customer ON orders FOR INSERT WITH CHECK (store_id IN (SELECT store_id FROM users WHERE users.id = auth.uid()::text));

-- Order items: inherited via parent order
CREATE POLICY order_items_select ON order_items FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.store_id = get_user_store_id() OR orders.user_id = auth.uid()::text)));
CREATE POLICY order_items_all_owner ON order_items FOR ALL USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.store_id = get_user_store_id())) WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.store_id = get_user_store_id()));

-- Invoices: owner only
CREATE POLICY invoices_all_owner ON invoices FOR ALL USING (store_id = get_user_store_id()) WITH CHECK (store_id = get_user_store_id());

-- Users: owner manages store users, self read/update
CREATE POLICY users_all_owner ON users FOR ALL USING (store_id = get_user_store_id()) WITH CHECK (store_id = get_user_store_id());
CREATE POLICY users_self ON users FOR SELECT USING (id = auth.uid()::text);
CREATE POLICY users_update_self ON users FOR UPDATE USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text);

-- Settings: public read, owner write
CREATE POLICY settings_select_public ON settings FOR SELECT USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = settings.store_id AND stores.status = 'active'));
CREATE POLICY settings_all_owner ON settings FOR ALL USING (store_id = get_user_store_id()) WITH CHECK (store_id = get_user_store_id());

-- Grant permissions
GRANT SELECT ON stores TO anon, authenticated;
GRANT ALL ON stores TO authenticated;
GRANT SELECT ON products TO anon, authenticated;
GRANT ALL ON products TO authenticated;
GRANT SELECT ON categories TO anon, authenticated;
GRANT ALL ON categories TO authenticated;
GRANT SELECT, INSERT ON orders TO anon, authenticated;
GRANT ALL ON orders TO authenticated;
GRANT SELECT, INSERT ON order_items TO anon, authenticated;
GRANT ALL ON order_items TO authenticated;
GRANT SELECT ON invoices TO anon, authenticated;
GRANT ALL ON invoices TO authenticated;
GRANT SELECT ON users TO anon, authenticated;
GRANT ALL ON users TO authenticated;
GRANT SELECT ON settings TO anon, authenticated;
GRANT ALL ON settings TO authenticated;
```

### 1.4 — Migration 003: Nullable customer_email (Phone-First Checkout)

```sql
ALTER TABLE orders ALTER COLUMN customer_email DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN customer_email SET DEFAULT NULL;
UPDATE orders SET customer_email = NULL WHERE customer_email = '';
```

### 1.5 — Migration 004: WhatsApp Number in Settings

```sql
ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_number text DEFAULT '' NOT NULL;
```

### 1.6 — Migration 005: Subscription Tiers & Plan Status

```sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'active'
  CHECK (plan_status IN ('active', 'past_due', 'canceled', 'trialing'));
ALTER TABLE stores ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT NULL;

-- Upgrade default store to enterprise (preserves all features)
UPDATE stores SET plan = 'enterprise', plan_status = 'active'
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

CREATE INDEX IF NOT EXISTS idx_stores_plan ON stores(plan);
CREATE INDEX IF NOT EXISTS idx_stores_plan_status ON stores(plan_status);
```

---

## 2. Environment Variables Manifest

Configure these in **Vercel Dashboard → Settings → Environment Variables**.

### 2.1 — Supabase Core (Required)

| Variable | Scope | Description |
|----------|-------|-------------|
| `SUPABASE_URL` | **Server-only** | Project URL from Supabase Dashboard → API → "Project URL" |
| `SUPABASE_ANON_KEY` | **Server-only** | Public anon key (only used server-side for RLS context) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Service role key — **NEVER expose to client**. Required for all write operations. |

> **Important:** Do NOT prefix these with `NEXT_PUBLIC_`. The app uses a server-only Supabase client via `src/lib/server/supabase.ts`. No Supabase key is ever bundled into the client JS.

### 2.2 — Session & Auth (Required)

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXTAUTH_SECRET` | **Server-only** | 32+ byte random string for HMAC session signing. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

### 2.3 — AI Integration (Optional — Enables AI Description Generator)

| Variable | Scope | Description |
|----------|-------|-------------|
| `GEMINI_API_KEY` | **Server-only** | Google Gemini API key (preferred — free tier available). Get from [AI Studio](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | **Server-only** | OpenAI API key (used as fallback if Gemini is not set) |

> Set **at least one** to enable the "Generate with AI" button in the admin product editor. If neither is set, the button still renders but returns a 503 with a clear message.

### 2.4 — Domain Configuration (Production)

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_ROOT_DOMAIN` | **Client + Server** | Your platform's apex domain (e.g., `nova-commerce.com`). Used by middleware for tenant detection. |

### 2.5 — Complete .env Template

```env
# ── Supabase (required) ──
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── Auth (required) ──
NEXTAUTH_SECRET=your-32-byte-random-base64url-string

# ── AI (optional) ──
GEMINI_API_KEY=AIzaSy...
# OPENAI_API_KEY=sk-...

# ── Domain (production) ──
NEXT_PUBLIC_ROOT_DOMAIN=nova-commerce.com
```

---

## 3. Build & Deployment Commands

### 3.1 — Vercel Project Settings

| Setting | Value |
|---------|-------|
| **Framework Preset** | Next.js |
| **Build Command** | `next build` |
| **Install Command** | `npm install` |
| **Output Directory** | `.next` (auto-detected) |
| **Root Directory** | `.` (repository root) |
| **Node.js Version** | **20.x** (LTS recommended) |

### 3.2 — Vercel Domain Configuration

1. **Platform root domain:** Add `nova-commerce.com` (or your chosen apex) as the primary domain.
2. **Wildcard subdomain:** Add `*.nova-commerce.com` to capture all tenant subdomains.
3. **Custom merchant domains:** Merchants on Enterprise plan add their domains via Vercel's API or CLI:
   ```bash
   vercel domains add mystore.com --project nova-commerce
   ```

### 3.3 — Middleware Runtime

The middleware (`src/middleware.ts`) runs on the **Edge Runtime** automatically. It:
- Extracts tenant from subdomain/custom domain
- Injects `x-tenant-slug` / `x-tenant-domain` / `x-is-platform-root` headers
- Gates `/admin/*` routes via HMAC session verification
- Matches: `/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)`

### 3.4 — Build Verification (Local)

```bash
# Install dependencies
npm install

# Type check (must pass with 0 errors)
npx tsc --noEmit

# Production build
npm run build

# Run migrations on Supabase (see Section 1)
# Then seed if needed:
npx tsx scripts/seed.ts
```

---

## 4. Post-Deployment Verification Checklist

### 4.1 — Marketing Landing Page (Platform Root)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `https://nova-commerce.com` | Dark hero section renders with "Launch your store in minutes" |
| 2 | Check feature grid | 6 cards visible: Multi-Tenant, Phone-First, WhatsApp, AI, Predictive Inventory, Micro-ERP |
| 3 | Click "Create Store" CTA | Navigates to `/register` |

### 4.2 — Tenant Subdomain Resolution

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `https://nova-default.nova-commerce.com` | Storefront loads (product grid, hero, categories) |
| 2 | Check API: `GET /api/settings` | Returns JSON with `storeName`, `currency`, `whatsappNumber` scoped to tenant |
| 3 | Check `x-tenant-slug` header | DevTools → Network → any request shows header = `nova-default` |

### 4.3 — Custom Domain Resolution (Enterprise)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Update store's `custom_domain` in Supabase to your test domain | Row updated |
| 2 | Add the domain in Vercel Dashboard | DNS verified |
| 3 | Navigate to `https://your-custom-domain.com` | Storefront loads correctly (same as subdomain) |
| 4 | Test with a free-plan store's custom domain | Returns 404 / "Store not found" (plan enforcement) |

### 4.4 — Phone-First Guest Checkout (Nullable Email)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open storefront as unauthenticated user | No email field visible on checkout form |
| 2 | Fill: Name + Phone + Address | All required fields validate |
| 3 | Submit order | Order created successfully — `customer_email` is NULL in DB |
| 4 | Check Supabase: `SELECT customer_email FROM orders ORDER BY created_at DESC LIMIT 1` | Returns `NULL` |
| 5 | If merchant has WhatsApp configured | "Confirm via WhatsApp" button appears on success page |

### 4.5 — AI Description Generator

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to `/admin/inventory` → Edit any product | Product editor modal opens |
| 2 | Click "Generate with AI" | Tone + Language selector panel opens |
| 3 | Select tone: "Professional", Language: "Arabic" | |
| 4 | Click "Generate" | Arabic description populates the Description (AR) textarea |
| 5 | **Free plan test:** Set store `plan` to `'free'` in DB | AI button should render but show upgrade banner (FeatureGate blocks) |

### 4.6 — Subscription Plan Enforcement

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set store `plan = 'free'` in Supabase | |
| 2 | Try creating 11th product via API | Returns 403 or blocked by `checkTenantLimits` |
| 3 | Set store `plan = 'pro'` | Unlimited products, AI enabled, predictive inventory visible |
| 4 | Set store `plan = 'enterprise'` | Custom domain resolves, all features unlocked |

### 4.7 — WhatsApp Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin Settings → WhatsApp → Enter `+212612345678` → Save | Settings persisted |
| 2 | Open product QuickView | Green "Order via WhatsApp" button visible below "Add to Cart" |
| 3 | Click the button | Opens `wa.me/212612345678?text=...` with product name + price in message |
| 4 | Complete checkout | Success page shows "Confirm Order via WhatsApp" with order ID + items |

### 4.8 — Inventory Intelligence

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin` dashboard | "Inventory Intelligence" section visible |
| 2 | Check velocity column | Products with recent orders show `X.XX units/day` |
| 3 | Check "Days Left" | Calculated as `stock / daily_run_rate` |
| 4 | Products with 0 sales in 14 days | Shows "Stable / No recent sales" (no division-by-zero) |
| 5 | Products with ≤3 days left | Red "Out of Stock Risk" badge |

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Edge middleware — tenant detection + admin auth |
| `src/lib/server/tenant.ts` | Store resolution + 60s cache + plan enforcement |
| `src/lib/server/plan-limits.ts` | `checkTenantLimits()` — feature gating logic |
| `src/lib/server/db.ts` | All Supabase queries (store_id scoped) |
| `src/lib/whatsapp.ts` | WhatsApp URL builder (typed payloads) |
| `src/app/api/ai/generate-description/route.ts` | AI endpoint (Gemini + OpenAI) |
| `src/app/page.tsx` | Root: marketing landing or storefront (conditional) |
| `src/components/marketing/LandingPage.tsx` | Platform marketing page |
| `src/components/admin/UpgradeBanner.tsx` | Plan upgrade paywall UI |

---

## Security Notes

- **Service Role Key** is NEVER exposed to the browser. All Supabase writes go through server-only API routes.
- **HMAC session tokens** are verified in Edge Middleware for `/admin/*` and admin API routes.
- **RLS** provides defense-in-depth — even if the service-role key leaks, direct client access is still tenant-isolated.
- **AI API key** is server-only — the generation endpoint validates admin role + active tenant before calling external APIs.
- **Custom domains** only resolve for stores on `enterprise` or `pro` plans — enforced at the application layer in `resolveCurrentTenant()`.

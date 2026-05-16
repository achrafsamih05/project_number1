-- ============================================================================
-- Migration 001: Multi-Tenant SaaS — Create stores table & inject store_id
-- ============================================================================
-- This migration transforms the single-store Nova e-commerce app into a
-- multi-tenant Commerce OS platform. Every resource (products, orders,
-- settings, users) will belong to a specific store.
--
-- ZERO DOWNTIME: We ALTER existing tables (never DROP). Existing data gets
-- a default store assigned so nothing breaks during the transition.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Create the `stores` table
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL,                        -- references the auth user who owns this store
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,                 -- e.g. 'nova-shop' → nova-shop.commerce-os.com
  custom_domain text UNIQUE,                          -- e.g. 'www.myshop.com' (nullable)
  logo_url      text,                                 -- store logo
  status        text NOT NULL DEFAULT 'active'        -- active | suspended | onboarding
    CHECK (status IN ('active', 'suspended', 'onboarding')),
  plan          text NOT NULL DEFAULT 'free'          -- free | starter | pro | enterprise
    CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_custom_domain ON stores(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- --------------------------------------------------------------------------
-- 2. Create a default store for existing data migration
-- --------------------------------------------------------------------------
-- This ensures all pre-existing data can be linked to a store without
-- breaking anything. The owner_id uses a placeholder UUID that should be
-- updated to the actual admin user's auth.users id after migration.
-- --------------------------------------------------------------------------

INSERT INTO stores (id, owner_id, name, slug, status)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,  -- placeholder; update to real owner
  'Nova (Default Store)',
  'nova-default',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- 3. Add store_id to `products`
-- --------------------------------------------------------------------------

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS store_id uuid
    REFERENCES stores(id) ON DELETE CASCADE;

-- Backfill existing products with the default store
UPDATE products SET store_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE store_id IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE products
  ALTER COLUMN store_id SET NOT NULL;

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

-- --------------------------------------------------------------------------
-- 4. Add store_id to `categories`
-- --------------------------------------------------------------------------

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS store_id uuid
    REFERENCES stores(id) ON DELETE CASCADE;

UPDATE categories SET store_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE store_id IS NULL;

ALTER TABLE categories
  ALTER COLUMN store_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);

-- --------------------------------------------------------------------------
-- 5. Add store_id to `orders`
-- --------------------------------------------------------------------------

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS store_id uuid
    REFERENCES stores(id) ON DELETE CASCADE;

UPDATE orders SET store_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE store_id IS NULL;

ALTER TABLE orders
  ALTER COLUMN store_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);

-- --------------------------------------------------------------------------
-- 6. Add store_id to `invoices`
-- --------------------------------------------------------------------------

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS store_id uuid
    REFERENCES stores(id) ON DELETE CASCADE;

UPDATE invoices SET store_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE store_id IS NULL;

ALTER TABLE invoices
  ALTER COLUMN store_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_store_id ON invoices(store_id);

-- --------------------------------------------------------------------------
-- 7. Add store_id to `users` (profile / membership link)
-- --------------------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS store_id uuid
    REFERENCES stores(id) ON DELETE CASCADE;

UPDATE users SET store_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE store_id IS NULL;

ALTER TABLE users
  ALTER COLUMN store_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);

-- --------------------------------------------------------------------------
-- 8. Transform `settings` from single-row to per-store settings
-- --------------------------------------------------------------------------
-- We add store_id and remove the id=1 CHECK so each store can have its own
-- settings row.
-- --------------------------------------------------------------------------

-- Drop the old check constraint that forces id=1 (if it exists)
DO $$
BEGIN
  ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_id_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS store_id uuid
    REFERENCES stores(id) ON DELETE CASCADE;

UPDATE settings SET store_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE store_id IS NULL;

ALTER TABLE settings
  ALTER COLUMN store_id SET NOT NULL;

-- Add unique constraint: one settings row per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_store_id ON settings(store_id);

-- --------------------------------------------------------------------------
-- 9. Helper function: get store_id for the current authenticated user
-- --------------------------------------------------------------------------
-- Used by RLS policies. Returns the store_id that the current auth user owns.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM stores WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- --------------------------------------------------------------------------
-- Done! Next migration (002) will enable RLS policies.
-- --------------------------------------------------------------------------

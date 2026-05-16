-- ============================================================================
-- Migration 002: Row Level Security (RLS) Policies for Multi-Tenant Isolation
-- ============================================================================
-- Enforces strict tenant isolation so that authenticated merchants can only
-- read/write data associated with their own store_id.
--
-- Policy naming convention: {table}_{action}_{scope}
--   e.g. products_all_owner = owner can do ALL on products
--
-- NOTE: The server-side Next.js app uses the service-role key which BYPASSES
-- RLS by design. These policies protect against:
--   1. Direct Supabase client access from the browser (anon key)
--   2. Future migration to per-user Supabase auth tokens
--   3. Defense-in-depth if the service-role key is ever removed
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Enable RLS on all tenant-scoped tables
-- --------------------------------------------------------------------------

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- 2. Stores table policies
-- --------------------------------------------------------------------------
-- Store owners can read/update their own store. Anyone can read active stores
-- (needed for storefront resolution by slug/domain).
-- --------------------------------------------------------------------------

-- Public: anyone can look up active stores (for tenant resolution)
CREATE POLICY stores_select_public ON stores
  FOR SELECT
  USING (status = 'active');

-- Owner: full control over their own store
CREATE POLICY stores_all_owner ON stores
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- --------------------------------------------------------------------------
-- 3. Products table policies
-- --------------------------------------------------------------------------
-- Public storefront: anyone can READ products for any active store (needed
-- for the public-facing storefront). Writes are restricted to store owner.
-- --------------------------------------------------------------------------

-- Public: read products belonging to any active store
CREATE POLICY products_select_public ON products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
        AND stores.status = 'active'
    )
  );

-- Owner: full CRUD on their own store's products
CREATE POLICY products_all_owner ON products
  FOR ALL
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- --------------------------------------------------------------------------
-- 4. Categories table policies
-- --------------------------------------------------------------------------

-- Public: read categories for any active store
CREATE POLICY categories_select_public ON categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = categories.store_id
        AND stores.status = 'active'
    )
  );

-- Owner: full CRUD on their own store's categories
CREATE POLICY categories_all_owner ON categories
  FOR ALL
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- --------------------------------------------------------------------------
-- 5. Orders table policies
-- --------------------------------------------------------------------------
-- Store owner can see all orders for their store. Customers can see their
-- own orders (matched by user_id in the users table with same store_id).
-- --------------------------------------------------------------------------

-- Owner: full access to their store's orders
CREATE POLICY orders_all_owner ON orders
  FOR ALL
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Customer: can read their own orders and insert new ones
CREATE POLICY orders_select_customer ON orders
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE users.id = auth.uid()::text
    )
    AND store_id IN (
      SELECT store_id FROM users WHERE users.id = auth.uid()::text
    )
  );

CREATE POLICY orders_insert_customer ON orders
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM users WHERE users.id = auth.uid()::text
    )
  );

-- --------------------------------------------------------------------------
-- 6. Order Items table policies
-- --------------------------------------------------------------------------
-- Access is inherited through the parent order's store_id.
-- --------------------------------------------------------------------------

-- Anyone who can read the parent order can read its items
CREATE POLICY order_items_select ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (
          orders.store_id = get_user_store_id()
          OR orders.user_id = auth.uid()::text
        )
    )
  );

-- Owner: full access to order items in their store
CREATE POLICY order_items_all_owner ON order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.store_id = get_user_store_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.store_id = get_user_store_id()
    )
  );

-- --------------------------------------------------------------------------
-- 7. Invoices table policies
-- --------------------------------------------------------------------------

-- Owner: full access to their store's invoices
CREATE POLICY invoices_all_owner ON invoices
  FOR ALL
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- --------------------------------------------------------------------------
-- 8. Users table policies
-- --------------------------------------------------------------------------
-- Store owners can manage users in their store. Users can read/update their
-- own profile.
-- --------------------------------------------------------------------------

-- Owner: full access to users in their store
CREATE POLICY users_all_owner ON users
  FOR ALL
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Self: users can read and update their own profile
CREATE POLICY users_self ON users
  FOR SELECT
  USING (id = auth.uid()::text);

CREATE POLICY users_update_self ON users
  FOR UPDATE
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- --------------------------------------------------------------------------
-- 9. Settings table policies
-- --------------------------------------------------------------------------
-- Public: anyone can read settings for active stores (storefront needs
-- store_name, currency, etc.). Only the store owner can update.
-- --------------------------------------------------------------------------

-- Public: read settings for any active store
CREATE POLICY settings_select_public ON settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = settings.store_id
        AND stores.status = 'active'
    )
  );

-- Owner: full access to their store's settings
CREATE POLICY settings_all_owner ON settings
  FOR ALL
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- --------------------------------------------------------------------------
-- 10. Grant usage to authenticated and anon roles
-- --------------------------------------------------------------------------
-- Supabase uses `anon` for unauthenticated and `authenticated` for logged-in
-- users. The service_role bypasses RLS entirely.
-- --------------------------------------------------------------------------

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

-- --------------------------------------------------------------------------
-- Done! RLS is now active. The service-role client bypasses all policies,
-- so the existing server-side code continues to work. The policies protect
-- against direct browser-side Supabase access and future auth migrations.
-- --------------------------------------------------------------------------

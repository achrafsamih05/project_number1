-- ============================================================================
-- Migration 003: Make customer_email nullable in orders table
-- ============================================================================
-- The checkout flow now supports phone-first guest orders where email is
-- NOT required. This migration ensures the DB schema matches by dropping
-- the NOT NULL constraint on customer_email (if it exists).
--
-- ZERO DOWNTIME: ALTER COLUMN ... DROP NOT NULL is a metadata-only change
-- in PostgreSQL — no table rewrite, no lock escalation.
-- ============================================================================

-- Drop NOT NULL on customer_email so guest orders can omit email entirely.
ALTER TABLE orders
  ALTER COLUMN customer_email DROP NOT NULL;

-- Also ensure the default is NULL (not empty string) for clarity.
ALTER TABLE orders
  ALTER COLUMN customer_email SET DEFAULT NULL;

-- Verify: any existing empty-string emails can be normalized to NULL.
-- This is optional but keeps the data clean for future queries.
UPDATE orders
  SET customer_email = NULL
  WHERE customer_email = '';

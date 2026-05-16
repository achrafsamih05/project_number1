-- ============================================================================
-- Migration 005: Subscription Tier Tracking & Usage Limits
-- ============================================================================
-- Adds billing/subscription fields to the stores table for SaaS plan
-- enforcement. The `plan` column already exists (free/starter/pro/enterprise)
-- from migration 001 — we just add plan_status and trial tracking.
--
-- ZERO INTERRUPTION: Existing stores default to 'active' plan_status and
-- the default store gets upgraded to 'enterprise' so nothing breaks.
-- ============================================================================

-- Add plan_status for billing state tracking
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'active'
    CHECK (plan_status IN ('active', 'past_due', 'canceled', 'trialing'));

-- Add trial expiration timestamp
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT NULL;

-- Upgrade the default store to enterprise so existing functionality is preserved
UPDATE stores
  SET plan = 'enterprise', plan_status = 'active'
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Index for plan-based queries (e.g., finding all free-tier stores)
CREATE INDEX IF NOT EXISTS idx_stores_plan ON stores(plan);
CREATE INDEX IF NOT EXISTS idx_stores_plan_status ON stores(plan_status);

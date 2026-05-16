-- ============================================================================
-- Migration 004: Add whatsapp_number to settings table
-- ============================================================================
-- Merchants in emerging markets use WhatsApp as their primary communication
-- channel for order confirmation and customer support. This column stores the
-- merchant's WhatsApp-enabled phone number (with country code, e.g. +212...).
-- ============================================================================

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS whatsapp_number text DEFAULT '' NOT NULL;

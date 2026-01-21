-- Migration 053: Add custom slug to CTV
-- Purpose: Allow CTV to customize their referral link
-- Date: 2026-01-21

-- Add custom_slug column (unique, nullable)
ALTER TABLE ctv ADD COLUMN custom_slug TEXT UNIQUE;

-- Add slug tracking columns
ALTER TABLE ctv ADD COLUMN slug_updated_at_unix INTEGER;
ALTER TABLE ctv ADD COLUMN slug_change_count INTEGER DEFAULT 0;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_ctv_custom_slug ON ctv(custom_slug);

-- Note: custom_slug must be unique and follow rules:
-- - 4-20 characters
-- - Only lowercase letters, numbers, hyphens (a-z, 0-9, -)
-- - Cannot conflict with existing referral_code
-- - Cannot be reserved words (admin, api, ctv, etc.)

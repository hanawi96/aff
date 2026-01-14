-- Migration: Add allowed_customer_phones column to discounts table
-- Purpose: Support customer-specific discount codes (Quick Discount feature)
-- Date: 2026-01-14

-- Add allowed_customer_phones column if not exists
-- This column stores JSON array of phone numbers that can use this discount
-- Example: ["0901234567", "0912345678"]

-- Check if column exists first (SQLite doesn't have IF NOT EXISTS for ALTER TABLE)
-- We'll use a safe approach: try to add it, ignore if exists

-- For Turso/LibSQL, we can use this approach:
ALTER TABLE discounts ADD COLUMN allowed_customer_phones TEXT;

-- Note: If column already exists, this will fail but won't break anything
-- Run this migration only once on production database

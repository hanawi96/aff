-- Migration 039: Remove old created_at and updated_at columns from discounts table
-- These columns have been replaced with created_at_unix and updated_at_unix

-- Drop indexes first
DROP INDEX IF EXISTS idx_discounts_created_at;
DROP INDEX IF EXISTS idx_discounts_updated_at;

-- Drop old datetime columns
ALTER TABLE discounts DROP COLUMN created_at;
ALTER TABLE discounts DROP COLUMN updated_at;

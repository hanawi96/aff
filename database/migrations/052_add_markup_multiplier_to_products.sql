-- Migration 052: Add markup_multiplier to products table
-- Purpose: Store markup multiplier for automatic price recalculation when material costs change
-- Date: 2026-01-20

-- Add markup_multiplier column
ALTER TABLE products ADD COLUMN markup_multiplier REAL DEFAULT NULL;


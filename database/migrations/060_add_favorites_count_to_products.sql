-- Migration 060: Add favorites_count column to products table
-- Date: 2026-01-25
-- Description: Add favorites_count column to track product favorites

ALTER TABLE products ADD COLUMN favorites_count INTEGER DEFAULT 0;

-- Update existing products to have 0 favorites initially
UPDATE products SET favorites_count = 0 WHERE favorites_count IS NULL;
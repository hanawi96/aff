-- Migration 062: Add pricing_method to products table
-- This field stores how the product price was calculated: 'markup' or 'profit'

-- Add pricing_method column to products table
ALTER TABLE products ADD COLUMN pricing_method TEXT DEFAULT 'markup' CHECK (pricing_method IN ('markup', 'profit'));

-- Add target_profit column to store the desired profit amount when using profit method
ALTER TABLE products ADD COLUMN target_profit REAL DEFAULT NULL;

-- Update existing products to use markup method by default
UPDATE products SET pricing_method = 'markup' WHERE pricing_method IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_pricing_method ON products(pricing_method);
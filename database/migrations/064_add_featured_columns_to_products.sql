-- Migration 064: Add featured columns to products table
-- This replaces the separate featured_products table with columns in products

-- Add featured columns to products table
ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN featured_order INTEGER DEFAULT NULL;
ALTER TABLE products ADD COLUMN featured_at_unix INTEGER DEFAULT NULL;

-- Create index for better performance when querying featured products
CREATE INDEX idx_products_featured ON products(is_featured, featured_order) WHERE is_featured = 1;

-- Migration completed
-- Note: The featured_products table can be dropped after data migration if needed
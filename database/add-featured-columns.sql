-- Migration: Add featured columns to products table
-- Thêm các cột is_featured, featured_order, featured_at_unix vào bảng products

-- Add is_featured column (0 = not featured, 1 = featured)
ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0;

-- Add featured_order column (thứ tự hiển thị)
ALTER TABLE products ADD COLUMN featured_order INTEGER DEFAULT NULL;

-- Add featured_at_unix column (thời gian thêm vào featured)
ALTER TABLE products ADD COLUMN featured_at_unix INTEGER DEFAULT NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured, featured_order);
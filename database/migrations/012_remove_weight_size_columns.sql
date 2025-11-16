-- Migration: Remove weight and size columns from products table
-- Created: 2024-11-15
-- Description: Remove unused weight and size columns from products table

-- SQLite doesn't support DROP COLUMN directly, so we need to:
-- 1. Create a new table without weight and size columns
-- 2. Copy data from old table
-- 3. Drop old table
-- 4. Rename new table

-- Create new products table without weight and size columns
CREATE TABLE IF NOT EXISTS products_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    sku TEXT UNIQUE,
    description TEXT,
    image_url TEXT,
    category_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    original_price REAL,
    rating REAL DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    cost_price REAL DEFAULT 0
);

-- Copy data from old table to new table (excluding weight and size)
INSERT INTO products_new (id, name, price, sku, description, image_url, category_id, is_active, created_at, updated_at, original_price, rating, purchases, stock_quantity, cost_price)
SELECT id, name, price, sku, description, image_url, category_id, is_active, created_at, updated_at, original_price, rating, purchases, stock_quantity, cost_price
FROM products;

-- Drop old table
DROP TABLE products;

-- Rename new table to products
ALTER TABLE products_new RENAME TO products;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Verify the migration
SELECT 'Migration completed successfully. Weight and size columns removed from products table.' AS status;

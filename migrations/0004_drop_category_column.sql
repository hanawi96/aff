-- Migration: Drop redundant category column from products
-- Created: 2024-11-14
-- Reason: category_id is sufficient, category text is redundant

-- SQLite doesn't support DROP COLUMN directly, need to recreate table

-- 1. Create new table without category column
CREATE TABLE products_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    weight TEXT,
    size TEXT,
    sku TEXT UNIQUE,
    description TEXT,
    image_url TEXT,
    category_id INTEGER REFERENCES categories(id),
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Copy data from old table
INSERT INTO products_new (id, name, price, weight, size, sku, description, image_url, category_id, is_active, created_at, updated_at)
SELECT id, name, price, weight, size, sku, description, image_url, category_id, is_active, created_at, updated_at
FROM products;

-- 3. Drop old table
DROP TABLE products;

-- 4. Rename new table
ALTER TABLE products_new RENAME TO products;

-- 5. Recreate indexes
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_category_id ON products(category_id);

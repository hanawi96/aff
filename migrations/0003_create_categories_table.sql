-- Migration: Create categories table and link with products
-- Created: 2024-11-14

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    color TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster search
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);

-- Insert default categories
INSERT INTO categories (name, description, icon, color, display_order) VALUES
('Hạt', 'Các loại hạt tẩm', '🌰', '#f59e0b', 1),
('Vòng', 'Vòng trang trí các loại', '⭕', '#ef4444', 2),
('Mix', 'Combo trộn mix', '🎁', '#8b5cf6', 3),
('Túi', 'Túi đựng các loại', '👜', '#06b6d4', 4),
('Móc', 'Móc khóa, móc treo', '🔑', '#10b981', 5),
('Bó', 'Bó hoa, bó trang trí', '💐', '#ec4899', 6),
('Khác', 'Sản phẩm khác', '📦', '#6b7280', 99);

-- Update products table to use category_id instead of category text
-- First, add new column
ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id);

-- Create index for category_id
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Migrate existing category data
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = products.category) WHERE products.category IS NOT NULL;

-- Set default category for products without category
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Khác') WHERE products.category_id IS NULL;

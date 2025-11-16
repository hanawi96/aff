-- Migration: Create products table
-- Created: 2024-11-14

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    weight TEXT,
    size TEXT,
    sku TEXT UNIQUE,
    description TEXT,
    image_url TEXT,
    category TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster search
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Insert some sample products (optional - remove if not needed)
INSERT INTO products (name, price, weight, size, category, description) VALUES
('Hạt dẻ tẩm loại đẹp + chi đỏ', 50000, '500g', NULL, 'Hạt', 'Hạt dẻ tẩm chất lượng cao'),
('Vòng trơn cỡ điện dây đỏ', 79000, '3kg', NULL, 'Vòng', 'Vòng trơn màu đỏ'),
('Trộn mix bị bạc 3ly combo', 69000, '3kg', NULL, 'Mix', 'Combo trộn mix đặc biệt'),
('Túi Dâu Tằm Để Giường', 39000, '8kg', NULL, 'Túi', 'Túi dâu tằm chất lượng'),
('Móc chia khóa dầu tầm', 29000, NULL, 'Size M', 'Móc', 'Móc chia khóa tiện dụng'),
('Bó dâu 7 CÀNH (bé trai)', 35000, NULL, 'Size S', 'Bó', 'Bó dâu trang trí'),
('Bó dâu 9 CÀNH (bé gái)', 35000, NULL, 'Size M', 'Bó', 'Bó dâu trang trí');

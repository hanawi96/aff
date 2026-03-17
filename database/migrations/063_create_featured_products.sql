-- Migration 063: Create Featured Products System
-- Tạo hệ thống quản lý sản phẩm nổi bật với hiệu suất cao

-- Tạo bảng featured_products
CREATE TABLE IF NOT EXISTS featured_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at_unix INTEGER NOT NULL,
    updated_at_unix INTEGER NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Tạo index để tối ưu performance
CREATE INDEX IF NOT EXISTS idx_featured_products_order ON featured_products(display_order ASC);
CREATE INDEX IF NOT EXISTS idx_featured_products_product_id ON featured_products(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_products_unique ON featured_products(product_id);

-- Tạo trigger để tự động cập nhật updated_at_unix
CREATE TRIGGER IF NOT EXISTS update_featured_products_timestamp 
    AFTER UPDATE ON featured_products
BEGIN
    UPDATE featured_products 
    SET updated_at_unix = strftime('%s', 'now') 
    WHERE id = NEW.id;
END;
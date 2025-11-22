-- ============================================
-- MIGRATION: Product Categories Junction Table
-- Date: 2025-11-22
-- Purpose: Enable many-to-many relationship between products and categories
-- Database: vdt (remote)
-- ============================================

-- PHÂN TÍCH CẤU TRÚC HIỆN TẠI:
-- 
-- Bảng products:
--   - id (INTEGER, PK)
--   - name (TEXT, NOT NULL)
--   - category_id (INTEGER) - Quan hệ 1-nhiều hiện tại
--   - price, cost_price, original_price (REAL)
--   - sku, description, image_url (TEXT)
--   - rating (REAL), purchases, stock_quantity (INTEGER)
--   - is_active (INTEGER), created_at, updated_at (TEXT)
--
-- Bảng categories:
--   - id (INTEGER, PK)
--   - name (TEXT, NOT NULL, UNIQUE)
--   - description, icon, color (TEXT)
--   - display_order (INTEGER)
--   - is_active (INTEGER), created_at, updated_at (TEXT)
--
-- VẤN ĐỀ: 
--   Hiện tại products.category_id chỉ cho phép 1 sản phẩm thuộc 1 danh mục
--   Cần: 1 sản phẩm có thể thuộc nhiều danh mục (many-to-many)
--
-- GIẢI PHÁP:
--   Tạo bảng trung gian product_categories với các tính năng:
--   ✅ Quan hệ many-to-many
--   ✅ Primary category support (danh mục chính để hiển thị)
--   ✅ Display order cho mỗi category trong product
--   ✅ Cascade delete để đảm bảo data integrity
--   ✅ Indexes tối ưu cho query performance
--   ✅ Migration data từ category_id cũ
-- ============================================

-- Step 1: Create junction table
CREATE TABLE IF NOT EXISTS product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  
  -- Đánh dấu danh mục chính (hiển thị đầu tiên)
  is_primary INTEGER DEFAULT 0,
  
  -- Thứ tự hiển thị của category trong product (optional)
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign keys với CASCADE DELETE
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  
  -- Đảm bảo không có duplicate (product + category)
  UNIQUE(product_id, category_id)
);

-- Step 2: Create indexes for optimal query performance
-- Index cho query: "Lấy tất cả categories của 1 product"
CREATE INDEX IF NOT EXISTS idx_product_categories_product 
ON product_categories(product_id);

-- Index cho query: "Lấy tất cả products trong 1 category"
CREATE INDEX IF NOT EXISTS idx_product_categories_category 
ON product_categories(category_id);

-- Index cho query: "Lấy primary category của products"
CREATE INDEX IF NOT EXISTS idx_product_categories_primary 
ON product_categories(product_id, is_primary);

-- Composite index cho sorting
CREATE INDEX IF NOT EXISTS idx_product_categories_display 
ON product_categories(product_id, display_order);

-- Step 3: Migrate existing data from products.category_id
-- Chuyển dữ liệu cũ sang bảng mới, đánh dấu là primary category
INSERT INTO product_categories (product_id, category_id, is_primary, display_order)
SELECT 
    id as product_id, 
    category_id, 
    1 as is_primary,  -- Đánh dấu là danh mục chính
    0 as display_order
FROM products 
WHERE category_id IS NOT NULL 
  AND category_id != ''
  AND category_id > 0
  -- Chỉ migrate nếu category tồn tại
  AND category_id IN (SELECT id FROM categories);

-- Step 4: Create trigger to ensure only one primary category per product
CREATE TRIGGER IF NOT EXISTS ensure_single_primary_category
BEFORE INSERT ON product_categories
WHEN NEW.is_primary = 1
BEGIN
  -- Nếu insert primary category mới, bỏ primary của các category cũ
  UPDATE product_categories 
  SET is_primary = 0 
  WHERE product_id = NEW.product_id 
    AND is_primary = 1;
END;

-- Trigger tương tự cho UPDATE
CREATE TRIGGER IF NOT EXISTS ensure_single_primary_category_update
BEFORE UPDATE ON product_categories
WHEN NEW.is_primary = 1 AND OLD.is_primary = 0
BEGIN
  UPDATE product_categories 
  SET is_primary = 0 
  WHERE product_id = NEW.product_id 
    AND id != NEW.id
    AND is_primary = 1;
END;

-- ============================================
-- BACKWARD COMPATIBILITY
-- ============================================
-- GIỮ LẠI column products.category_id để:
-- 1. Backward compatibility với code cũ
-- 2. Dùng làm "primary category" reference nhanh
-- 3. Tránh breaking changes
--
-- Tạo trigger để tự động sync category_id với primary category
CREATE TRIGGER IF NOT EXISTS sync_primary_category_to_products
AFTER INSERT ON product_categories
WHEN NEW.is_primary = 1
BEGIN
  UPDATE products 
  SET category_id = NEW.category_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS sync_primary_category_update
AFTER UPDATE ON product_categories
WHEN NEW.is_primary = 1
BEGIN
  UPDATE products 
  SET category_id = NEW.category_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.product_id;
END;

-- Trigger khi xóa primary category
CREATE TRIGGER IF NOT EXISTS handle_primary_category_delete
AFTER DELETE ON product_categories
WHEN OLD.is_primary = 1
BEGIN
  -- Tìm category khác để làm primary (nếu có)
  UPDATE products 
  SET category_id = (
    SELECT category_id 
    FROM product_categories 
    WHERE product_id = OLD.product_id 
    ORDER BY display_order ASC 
    LIMIT 1
  ),
  updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.product_id;
END;

-- ============================================
-- VERIFICATION QUERIES (để test sau khi migrate)
-- ============================================
-- 1. Kiểm tra số lượng records đã migrate:
--    SELECT COUNT(*) FROM product_categories;
--
-- 2. Kiểm tra products có bao nhiêu categories:
--    SELECT p.name, COUNT(pc.category_id) as category_count
--    FROM products p
--    LEFT JOIN product_categories pc ON p.id = pc.product_id
--    GROUP BY p.id;
--
-- 3. Kiểm tra primary categories:
--    SELECT p.name, c.name as primary_category
--    FROM products p
--    JOIN product_categories pc ON p.id = pc.product_id AND pc.is_primary = 1
--    JOIN categories c ON pc.category_id = c.id;
--
-- 4. Kiểm tra sync giữa products.category_id và primary category:
--    SELECT p.id, p.name, p.category_id, pc.category_id as primary_cat
--    FROM products p
--    LEFT JOIN product_categories pc ON p.id = pc.product_id AND pc.is_primary = 1
--    WHERE p.category_id != pc.category_id OR pc.category_id IS NULL;
-- ============================================

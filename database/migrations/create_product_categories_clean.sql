CREATE TABLE IF NOT EXISTS product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  is_primary INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);

CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);

CREATE INDEX IF NOT EXISTS idx_product_categories_primary ON product_categories(product_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_product_categories_display ON product_categories(product_id, display_order);

INSERT INTO product_categories (product_id, category_id, is_primary, display_order)
SELECT id, category_id, 1, 0
FROM products 
WHERE category_id IS NOT NULL AND category_id > 0 AND category_id IN (SELECT id FROM categories);

CREATE TRIGGER IF NOT EXISTS ensure_single_primary_category
BEFORE INSERT ON product_categories
WHEN NEW.is_primary = 1
BEGIN
  UPDATE product_categories SET is_primary = 0 WHERE product_id = NEW.product_id AND is_primary = 1;
END;

CREATE TRIGGER IF NOT EXISTS ensure_single_primary_category_update
BEFORE UPDATE ON product_categories
WHEN NEW.is_primary = 1 AND OLD.is_primary = 0
BEGIN
  UPDATE product_categories SET is_primary = 0 WHERE product_id = NEW.product_id AND id != NEW.id AND is_primary = 1;
END;

CREATE TRIGGER IF NOT EXISTS sync_primary_category_to_products
AFTER INSERT ON product_categories
WHEN NEW.is_primary = 1
BEGIN
  UPDATE products SET category_id = NEW.category_id, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS sync_primary_category_update
AFTER UPDATE ON product_categories
WHEN NEW.is_primary = 1
BEGIN
  UPDATE products SET category_id = NEW.category_id, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS handle_primary_category_delete
AFTER DELETE ON product_categories
WHEN OLD.is_primary = 1
BEGIN
  UPDATE products SET category_id = (SELECT category_id FROM product_categories WHERE product_id = OLD.product_id ORDER BY display_order ASC LIMIT 1), updated_at = CURRENT_TIMESTAMP WHERE id = OLD.product_id;
END;

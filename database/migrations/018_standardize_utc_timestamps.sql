-- Migration 018: Standardize all timestamps to UTC
-- This migration ensures all datetime columns use UTC timezone consistently
-- Frontend will handle timezone conversion to Vietnam (UTC+7)

-- ============================================
-- STEP 1: Update CTV table
-- ============================================

-- Drop old trigger
DROP TRIGGER IF EXISTS update_ctv_timestamp;

-- Recreate CTV table with proper UTC timestamps
CREATE TABLE IF NOT EXISTS ctv_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  age TEXT,
  experience TEXT,
  motivation TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'Mới',
  commission_rate REAL DEFAULT 0.1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Copy data from old table (convert existing timestamps to UTC ISO format)
INSERT INTO ctv_new (id, full_name, phone, email, city, age, experience, motivation, referral_code, status, commission_rate, created_at, updated_at)
SELECT 
  id, 
  full_name, 
  phone, 
  email, 
  city, 
  age, 
  experience, 
  motivation, 
  referral_code, 
  status, 
  commission_rate,
  CASE 
    WHEN created_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN created_at LIKE '%Z' THEN created_at
    WHEN created_at LIKE '%T%' THEN created_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  END,
  CASE 
    WHEN updated_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN updated_at LIKE '%Z' THEN updated_at
    WHEN updated_at LIKE '%T%' THEN updated_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
  END
FROM ctv;

-- Drop old table and rename new one
DROP TABLE ctv;
ALTER TABLE ctv_new RENAME TO ctv;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_ctv_referral_code ON ctv(referral_code);
CREATE INDEX IF NOT EXISTS idx_ctv_phone ON ctv(phone);
CREATE INDEX IF NOT EXISTS idx_ctv_created_at ON ctv(created_at);

-- Recreate trigger with UTC
CREATE TRIGGER IF NOT EXISTS update_ctv_timestamp 
AFTER UPDATE ON ctv
BEGIN
  UPDATE ctv SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- ============================================
-- STEP 2: Update Orders table
-- ============================================

-- Recreate orders table with proper UTC timestamps
CREATE TABLE IF NOT EXISTS orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  order_date TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  address TEXT,
  products TEXT,
  total_amount REAL DEFAULT 0,
  payment_method TEXT,
  status TEXT,
  referral_code TEXT,
  commission REAL DEFAULT 0,
  ctv_phone TEXT,
  ctv_commission_rate REAL,
  notes TEXT,
  shipping_fee REAL DEFAULT 0,
  shipping_cost REAL DEFAULT 0,
  packaging_cost REAL DEFAULT 0,
  tax_rate REAL,
  tax_amount REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (referral_code) REFERENCES ctv(referral_code)
);

-- Copy data from old table (convert existing timestamps to UTC ISO format)
INSERT INTO orders_new (
  id, order_id, order_date, customer_name, customer_phone, address, products,
  total_amount, payment_method, status, referral_code, commission, ctv_phone,
  ctv_commission_rate, notes, shipping_fee, shipping_cost, packaging_cost,
  tax_rate, tax_amount, created_at, updated_at
)
SELECT 
  id, order_id,
  -- Convert order_date to UTC ISO format
  CASE 
    WHEN order_date IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN order_date LIKE '%Z' THEN order_date
    WHEN order_date LIKE '%T%' THEN order_date || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', order_date)
  END,
  customer_name, customer_phone, address, products,
  total_amount, payment_method, status, referral_code, commission, ctv_phone,
  ctv_commission_rate, notes, shipping_fee, shipping_cost, packaging_cost,
  tax_rate, tax_amount,
  -- Convert created_at to UTC ISO format
  CASE 
    WHEN created_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN created_at LIKE '%Z' THEN created_at
    WHEN created_at LIKE '%T%' THEN created_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  END,
  -- Convert updated_at to UTC ISO format
  CASE 
    WHEN updated_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN updated_at LIKE '%Z' THEN updated_at
    WHEN updated_at LIKE '%T%' THEN updated_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
  END
FROM orders;

-- Drop old table and rename new one
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON orders(referral_code);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_ctv_phone ON orders(ctv_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Recreate trigger with UTC
CREATE TRIGGER IF NOT EXISTS update_orders_timestamp 
AFTER UPDATE ON orders
BEGIN
  UPDATE orders SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- ============================================
-- STEP 3: Update Order Items table
-- ============================================

-- Recreate order_items table with proper UTC timestamps
CREATE TABLE IF NOT EXISTS order_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  product_price REAL NOT NULL,
  product_cost REAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Copy data from old table
INSERT INTO order_items_new (id, order_id, product_id, product_name, product_price, product_cost, quantity, created_at)
SELECT 
  id, order_id, product_id, product_name, product_price, product_cost, quantity,
  CASE 
    WHEN created_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN created_at LIKE '%Z' THEN created_at
    WHEN created_at LIKE '%T%' THEN created_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  END
FROM order_items;

-- Drop old table and rename new one
DROP TABLE order_items;
ALTER TABLE order_items_new RENAME TO order_items;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- ============================================
-- STEP 4: Update Products table
-- ============================================

-- Recreate products table with proper UTC timestamps
CREATE TABLE IF NOT EXISTS products_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  category_id INTEGER,
  description TEXT,
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Copy data from old table
INSERT INTO products_new (id, name, price, cost, category_id, description, image_url, is_active, created_at, updated_at)
SELECT 
  id, name, price, cost, category_id, description, image_url, is_active,
  CASE 
    WHEN created_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN created_at LIKE '%Z' THEN created_at
    WHEN created_at LIKE '%T%' THEN created_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  END,
  CASE 
    WHEN updated_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN updated_at LIKE '%Z' THEN updated_at
    WHEN updated_at LIKE '%T%' THEN updated_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
  END
FROM products;

-- Drop old table and rename new one
DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Recreate trigger with UTC
CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
AFTER UPDATE ON products
BEGIN
  UPDATE products SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- ============================================
-- STEP 5: Update Categories table
-- ============================================

-- Recreate categories table with proper UTC timestamps
CREATE TABLE IF NOT EXISTS categories_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Copy data from old table
INSERT INTO categories_new (id, name, description, display_order, is_active, created_at, updated_at)
SELECT 
  id, name, description, display_order, is_active,
  CASE 
    WHEN created_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN created_at LIKE '%Z' THEN created_at
    WHEN created_at LIKE '%T%' THEN created_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  END,
  CASE 
    WHEN updated_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN updated_at LIKE '%Z' THEN updated_at
    WHEN updated_at LIKE '%T%' THEN updated_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
  END
FROM categories;

-- Drop old table and rename new one
DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);

-- Recreate trigger with UTC
CREATE TRIGGER IF NOT EXISTS update_categories_timestamp 
AFTER UPDATE ON categories
BEGIN
  UPDATE categories SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- ============================================
-- STEP 6: Update Customers table
-- ============================================

-- Recreate customers table with proper UTC timestamps
CREATE TABLE IF NOT EXISTS customers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Copy data from old table
INSERT INTO customers_new (id, name, phone, email, address, city, notes, created_at, updated_at)
SELECT 
  id, name, phone, email, address, city, notes,
  CASE 
    WHEN created_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN created_at LIKE '%Z' THEN created_at
    WHEN created_at LIKE '%T%' THEN created_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  END,
  CASE 
    WHEN updated_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN updated_at LIKE '%Z' THEN updated_at
    WHEN updated_at LIKE '%T%' THEN updated_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
  END
FROM customers;

-- Drop old table and rename new one
DROP TABLE customers;
ALTER TABLE customers_new RENAME TO customers;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Recreate trigger with UTC
CREATE TRIGGER IF NOT EXISTS update_customers_timestamp 
AFTER UPDATE ON customers
BEGIN
  UPDATE customers SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- ============================================
-- STEP 7: Update Cost Config table
-- ============================================

-- Recreate cost_config table with proper UTC timestamps
CREATE TABLE IF NOT EXISTS cost_config_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Copy data from old table
INSERT INTO cost_config_new (id, name, cost, is_default, created_at, updated_at)
SELECT 
  id, name, cost, is_default,
  CASE 
    WHEN created_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN created_at LIKE '%Z' THEN created_at
    WHEN created_at LIKE '%T%' THEN created_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
  END,
  CASE 
    WHEN updated_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHEN updated_at LIKE '%Z' THEN updated_at
    WHEN updated_at LIKE '%T%' THEN updated_at || 'Z'
    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
  END
FROM cost_config;

-- Drop old table and rename new one
DROP TABLE cost_config;
ALTER TABLE cost_config_new RENAME TO cost_config;

-- Recreate trigger with UTC
CREATE TRIGGER IF NOT EXISTS update_cost_config_timestamp 
AFTER UPDATE ON cost_config
BEGIN
  UPDATE cost_config SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify all tables have UTC timestamps
SELECT 'CTV timestamps:' as info, MIN(created_at) as earliest, MAX(created_at) as latest FROM ctv;
SELECT 'Orders timestamps:' as info, MIN(created_at) as earliest, MAX(created_at) as latest FROM orders;
SELECT 'Order Items timestamps:' as info, MIN(created_at) as earliest, MAX(created_at) as latest FROM order_items;
SELECT 'Products timestamps:' as info, MIN(created_at) as earliest, MAX(created_at) as latest FROM products;
SELECT 'Categories timestamps:' as info, MIN(created_at) as earliest, MAX(created_at) as latest FROM categories;
SELECT 'Customers timestamps:' as info, MIN(created_at) as earliest, MAX(created_at) as latest FROM customers;
SELECT 'Cost Config timestamps:' as info, MIN(created_at) as earliest, MAX(created_at) as latest FROM cost_config;

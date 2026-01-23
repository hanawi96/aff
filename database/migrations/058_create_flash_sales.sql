-- Migration 058: Create flash sales system
-- Purpose: Manage flash sale campaigns with time-limited product discounts

-- Main flash sales table
CREATE TABLE IF NOT EXISTS flash_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Basic info
  name TEXT NOT NULL,                    -- "Flash Sale Cuối Tuần"
  description TEXT,
  
  -- Time range
  start_time INTEGER NOT NULL,           -- Unix timestamp
  end_time INTEGER NOT NULL,             -- Unix timestamp
  
  -- Status: draft, scheduled, active, ended, cancelled
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'active', 'ended', 'cancelled')),
  
  -- Display settings
  is_visible INTEGER DEFAULT 1,          -- Show on website
  banner_image TEXT,                     -- Optional banner image URL
  
  -- Timestamps
  created_at_unix INTEGER NOT NULL,
  updated_at_unix INTEGER NOT NULL,
  
  -- Constraints
  CHECK(end_time > start_time)
);

-- Flash sale products table
CREATE TABLE IF NOT EXISTS flash_sale_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Relations
  flash_sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  
  -- Pricing
  original_price REAL NOT NULL,          -- Original product price
  flash_price REAL NOT NULL,             -- Discounted price
  discount_percentage REAL,              -- Calculated discount %
  
  -- Stock management
  stock_limit INTEGER,                   -- Max quantity available (NULL = unlimited)
  sold_count INTEGER DEFAULT 0,          -- Number sold
  
  -- Status
  is_active INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at_unix INTEGER NOT NULL,
  updated_at_unix INTEGER NOT NULL,
  
  -- Foreign keys
  FOREIGN KEY (flash_sale_id) REFERENCES flash_sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  
  -- Constraints
  UNIQUE(flash_sale_id, product_id),
  CHECK(flash_price < original_price),
  CHECK(flash_price >= 0),
  CHECK(sold_count >= 0),
  CHECK(stock_limit IS NULL OR stock_limit > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flash_sales_status ON flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_time ON flash_sales(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_flash_sales_active_time ON flash_sales(status, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_sale ON flash_sale_products(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_product ON flash_sale_products(product_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_active ON flash_sale_products(flash_sale_id, is_active);
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_lookup ON flash_sale_products(product_id, is_active);

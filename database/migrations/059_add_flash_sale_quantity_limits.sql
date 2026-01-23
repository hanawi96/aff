-- Migration 059: Add quantity limits and purchase tracking for flash sales
-- Purpose: Support per-customer purchase limits and track purchase history

-- Step 1: Add max_per_customer column to flash_sale_products
ALTER TABLE flash_sale_products 
ADD COLUMN max_per_customer INTEGER DEFAULT NULL;
-- NULL = no limit, number > 0 = max quantity per customer

-- Step 2: Create flash_sale_purchases table for tracking
CREATE TABLE IF NOT EXISTS flash_sale_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Relations
  flash_sale_id INTEGER NOT NULL,
  flash_sale_product_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  
  -- Customer info
  customer_phone TEXT NOT NULL,  -- Use phone as unique identifier
  customer_name TEXT,
  
  -- Purchase details
  quantity INTEGER NOT NULL,
  flash_price REAL NOT NULL,
  total_amount REAL NOT NULL,
  
  -- Timestamp
  purchased_at_unix INTEGER NOT NULL,
  
  -- Foreign keys
  FOREIGN KEY (flash_sale_id) REFERENCES flash_sales(id) ON DELETE CASCADE,
  FOREIGN KEY (flash_sale_product_id) REFERENCES flash_sale_products(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Constraints
  CHECK(quantity > 0),
  CHECK(flash_price >= 0),
  CHECK(total_amount >= 0)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_flash_sale_purchases_customer_product 
ON flash_sale_purchases(customer_phone, flash_sale_product_id);

CREATE INDEX IF NOT EXISTS idx_flash_sale_purchases_flash_sale 
ON flash_sale_purchases(flash_sale_id, purchased_at_unix);

CREATE INDEX IF NOT EXISTS idx_flash_sale_purchases_product 
ON flash_sale_purchases(flash_sale_product_id);

CREATE INDEX IF NOT EXISTS idx_flash_sale_purchases_order 
ON flash_sale_purchases(order_id);

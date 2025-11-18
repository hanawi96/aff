-- Migration: Add performance indexes for faster queries
-- Created: 2024-11-18
-- Purpose: Optimize query performance for product sales analytics

-- Index 1: Speed up JOIN between order_items and orders
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON order_items(order_id);

-- Index 2: Speed up GROUP BY product_id
CREATE INDEX IF NOT EXISTS idx_order_items_product_id 
ON order_items(product_id);

-- Index 3: Speed up WHERE filter by date
CREATE INDEX IF NOT EXISTS idx_orders_created_at_unix 
ON orders(created_at_unix);

-- Index 4: Composite index for common query pattern (order_id + product_id)
CREATE INDEX IF NOT EXISTS idx_order_items_order_product 
ON order_items(order_id, product_id);

-- Index 5: Speed up products query by purchases (for top selling products)
CREATE INDEX IF NOT EXISTS idx_products_purchases 
ON products(purchases DESC);

-- Index 6: Speed up active products query
CREATE INDEX IF NOT EXISTS idx_products_active_purchases 
ON products(is_active, purchases DESC);

-- Verify indexes
SELECT 
    name as index_name,
    tbl_name as table_name,
    sql as definition
FROM sqlite_master 
WHERE type = 'index' 
AND name LIKE 'idx_%'
ORDER BY tbl_name, name;

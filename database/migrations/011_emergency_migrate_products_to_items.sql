-- Emergency Migration: Migrate products JSON to order_items
-- This is a simplified version that handles basic product data
-- For complex cases, use the API endpoint: ?action=migrateOrdersToItems

-- Note: This assumes products column contains JSON array like:
-- [{"name":"Product A","quantity":2,"price":50000,"weight":"5kg"}]

-- We'll insert basic items without product_id (will be NULL)
-- Price and cost will need to be updated manually or via API

-- For now, let's just verify the structure
SELECT 
    id,
    order_id,
    products,
    LENGTH(products) as products_length
FROM orders
WHERE products IS NOT NULL 
  AND products != ''
  AND products != '[]'
LIMIT 5;

-- Manual steps needed:
-- 1. Call API: GET /?action=migrateOrdersToItems
-- 2. Or manually insert items for each order
-- 3. Verify with: SELECT COUNT(*) FROM order_items;

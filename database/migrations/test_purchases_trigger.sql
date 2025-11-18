-- Test script to verify purchases trigger is working
-- This script will:
-- 1. Check current purchases count for a product
-- 2. Show recent order_items for that product
-- 3. Verify the count matches

-- Show products with their current purchases count
SELECT 
    id,
    name,
    purchases as current_purchases,
    (SELECT COALESCE(SUM(quantity), 0) 
     FROM order_items 
     WHERE product_id = products.id) as calculated_purchases
FROM products
WHERE id IN (SELECT DISTINCT product_id FROM order_items WHERE product_id IS NOT NULL)
ORDER BY purchases DESC
LIMIT 10;

-- Show summary
SELECT 
    COUNT(DISTINCT p.id) as total_products_with_orders,
    SUM(p.purchases) as total_purchases_in_db,
    (SELECT SUM(quantity) FROM order_items WHERE product_id IS NOT NULL) as total_quantity_in_order_items
FROM products p
WHERE p.id IN (SELECT DISTINCT product_id FROM order_items WHERE product_id IS NOT NULL);

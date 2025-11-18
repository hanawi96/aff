-- Migration: Reset and recalculate purchases from order_items
-- Created: 2024-11-18
-- Purpose: Fix incorrect purchases data by recalculating from actual order_items

-- Step 1: Reset all purchases to 0
UPDATE products SET purchases = 0;

-- Step 2: Recalculate purchases from order_items (actual sales data)
UPDATE products 
SET purchases = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM order_items oi
    WHERE oi.product_id = products.id
);

-- Step 3: Verify the results
SELECT 
    'Total products with sales' as metric,
    COUNT(*) as value
FROM products 
WHERE purchases > 0

UNION ALL

SELECT 
    'Total purchases count' as metric,
    SUM(purchases) as value
FROM products

UNION ALL

SELECT 
    'Total from order_items' as metric,
    SUM(quantity) as value
FROM order_items
WHERE product_id IS NOT NULL;

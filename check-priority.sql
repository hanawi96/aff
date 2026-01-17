-- Check priority values in orders table
SELECT 
    id,
    order_id,
    customer_name,
    is_priority,
    created_at
FROM orders
ORDER BY id DESC
LIMIT 10;

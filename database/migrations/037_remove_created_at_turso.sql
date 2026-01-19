-- Migration 037: Remove created_at column from orders table (Turso)
-- Turso supports ALTER TABLE DROP COLUMN directly

-- Step 1: Verify all orders have created_at_unix
SELECT 
    COUNT(*) as total_orders,
    COUNT(created_at_unix) as orders_with_unix_timestamp,
    COUNT(*) - COUNT(created_at_unix) as missing_timestamps
FROM orders;

-- Step 2: Drop the old created_at column
ALTER TABLE orders DROP COLUMN created_at;

-- Step 3: Verify migration
PRAGMA table_info(orders);

-- Step 4: Check data integrity
SELECT 
    COUNT(*) as total_orders,
    MIN(created_at_unix) as oldest_timestamp,
    MAX(created_at_unix) as newest_timestamp,
    datetime(MIN(created_at_unix) / 1000, 'unixepoch') as oldest_date,
    datetime(MAX(created_at_unix) / 1000, 'unixepoch') as newest_date
FROM orders;

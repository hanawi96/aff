-- Migration: Fix Timezone Timestamps
-- Purpose: Ensure all orders have created_at_unix for consistent timezone handling
-- Date: 2024-11-21

-- Step 1: Add created_at_unix column if not exists (should already exist)
-- This is just a safety check
ALTER TABLE orders ADD COLUMN created_at_unix INTEGER;

-- Step 2: Update created_at_unix from created_at for orders that don't have it
-- Convert SQLite DATETIME to Unix timestamp (milliseconds)
UPDATE orders 
SET created_at_unix = CAST(strftime('%s', created_at) AS INTEGER) * 1000
WHERE created_at_unix IS NULL 
  AND created_at IS NOT NULL;

-- Step 3: For orders with order_date but no created_at_unix
-- Assume order_date is already a Unix timestamp
UPDATE orders 
SET created_at_unix = CAST(order_date AS INTEGER)
WHERE created_at_unix IS NULL 
  AND order_date IS NOT NULL
  AND order_date NOT LIKE '%-%'; -- Not an ISO date string

-- Step 4: Create index on created_at_unix for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_created_at_unix ON orders(created_at_unix);

-- Step 5: Verify the migration
-- This will show orders with missing timestamps
SELECT 
    COUNT(*) as total_orders,
    COUNT(created_at_unix) as orders_with_unix_timestamp,
    COUNT(*) - COUNT(created_at_unix) as orders_missing_unix_timestamp
FROM orders;

-- Step 6: Show sample of converted timestamps
SELECT 
    order_id,
    order_date,
    created_at,
    created_at_unix,
    datetime(created_at_unix/1000, 'unixepoch') as readable_utc,
    datetime(created_at_unix/1000, 'unixepoch', '+7 hours') as readable_vn
FROM orders
ORDER BY id DESC
LIMIT 10;

-- Migration 054: Remove redundant order_date column
-- Keep only created_at_unix as the single source of truth for order timestamp
-- Reason: Both columns store the same value, causing redundancy

-- Step 1: Verify data consistency (optional check)
-- SELECT COUNT(*) FROM orders WHERE order_date != created_at_unix;

-- Step 2: Drop the order_date column
ALTER TABLE orders DROP COLUMN order_date;

-- Note: SQLite doesn't support DROP COLUMN directly in older versions
-- If this fails, we need to use the recreate table approach

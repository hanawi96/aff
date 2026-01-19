-- Migration 038: Add Unix timestamp columns to discounts table
-- For consistent timezone handling across all tables

-- Step 1: Add created_at_unix column (milliseconds since epoch)
ALTER TABLE discounts ADD COLUMN created_at_unix INTEGER;

-- Step 2: Add updated_at_unix column (milliseconds since epoch)
ALTER TABLE discounts ADD COLUMN updated_at_unix INTEGER;

-- Step 3: Migrate existing data from created_at to created_at_unix
-- Convert DATETIME to Unix timestamp (milliseconds)
UPDATE discounts 
SET created_at_unix = CAST((julianday(created_at) - 2440587.5) * 86400000 AS INTEGER)
WHERE created_at IS NOT NULL AND created_at_unix IS NULL;

-- Step 4: Migrate existing data from updated_at to updated_at_unix
UPDATE discounts 
SET updated_at_unix = CAST((julianday(updated_at) - 2440587.5) * 86400000 AS INTEGER)
WHERE updated_at IS NOT NULL AND updated_at_unix IS NULL;

-- Step 5: Set default value for new records (current timestamp in milliseconds)
-- Note: SQLite doesn't support DEFAULT with expressions, so we'll handle this in application code

-- Step 6: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_discounts_created_at_unix ON discounts(created_at_unix);
CREATE INDEX IF NOT EXISTS idx_discounts_updated_at_unix ON discounts(updated_at_unix);

-- Step 7: Verify migration
SELECT 
    COUNT(*) as total_discounts,
    COUNT(created_at_unix) as with_unix_timestamp,
    COUNT(*) - COUNT(created_at_unix) as missing_timestamps,
    MIN(created_at_unix) as oldest_timestamp,
    MAX(created_at_unix) as newest_timestamp
FROM discounts;

-- Step 8: Show sample data for verification
SELECT 
    id,
    code,
    created_at,
    created_at_unix,
    datetime(created_at_unix / 1000, 'unixepoch') as unix_readable,
    updated_at,
    updated_at_unix
FROM discounts
LIMIT 5;

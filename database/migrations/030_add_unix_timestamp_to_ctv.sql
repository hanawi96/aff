-- Migration: Add Unix Timestamp to CTV Table
-- Purpose: Add created_at_unix column for consistent timezone handling
-- Date: 2025-11-22

-- Step 1: Add created_at_unix column (milliseconds since epoch)
ALTER TABLE ctv ADD COLUMN created_at_unix INTEGER;

-- Step 2: Migrate existing data from created_at to created_at_unix
-- Convert SQLite DATETIME to Unix timestamp (milliseconds)
UPDATE ctv 
SET created_at_unix = CAST(strftime('%s', created_at) AS INTEGER) * 1000
WHERE created_at IS NOT NULL;

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ctv_created_at_unix ON ctv(created_at_unix);

-- Step 4: Verify the migration
SELECT 
    'Migration verification' as step,
    COUNT(*) as total_ctv,
    COUNT(created_at_unix) as with_unix_timestamp,
    COUNT(*) - COUNT(created_at_unix) as missing_unix_timestamp
FROM ctv;

-- Step 5: Show sample of converted timestamps
SELECT 
    id,
    full_name,
    referral_code,
    created_at,
    created_at_unix,
    datetime(created_at_unix/1000, 'unixepoch') as readable_utc,
    datetime(created_at_unix/1000, 'unixepoch', '+7 hours') as readable_vn
FROM ctv
ORDER BY id DESC
LIMIT 5;

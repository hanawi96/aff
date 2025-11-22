-- Migration: Fix CTV Timestamps Format
-- Purpose: Ensure created_at is stored in proper UTC format
-- Date: 2025-11-22

-- Step 1: Verify current timestamp format
SELECT 
    'Current timestamp format check' as step,
    id,
    full_name,
    created_at,
    typeof(created_at) as type,
    datetime(created_at) as formatted,
    datetime(created_at, '+7 hours') as vn_time
FROM ctv 
ORDER BY id DESC 
LIMIT 3;

-- Step 2: Check if any timestamps are NULL or invalid
SELECT 
    'Invalid timestamps check' as step,
    COUNT(*) as total_ctv,
    COUNT(created_at) as with_timestamp,
    COUNT(*) - COUNT(created_at) as missing_timestamp
FROM ctv;

-- Step 3: Verify timezone consistency
-- All created_at should be in UTC (SQLite CURRENT_TIMESTAMP is UTC)
SELECT 
    'Timezone verification' as step,
    MIN(created_at) as earliest_ctv,
    MAX(created_at) as latest_ctv,
    COUNT(*) as total_count
FROM ctv;

-- Note: SQLite CURRENT_TIMESTAMP already stores in UTC format (YYYY-MM-DD HH:MM:SS)
-- The issue is in the API query - we need to append 'Z' to indicate UTC timezone
-- This is handled in worker.js query:
-- SELECT datetime(created_at) || 'Z' as timestamp FROM ctv

-- No actual migration needed for the database
-- The fix is in the application layer (worker.js)

-- Migration 055: Normalize Address IDs to String Format
-- Convert address ID columns from INTEGER to TEXT with zero-padding
-- to match tree.json format

-- This migration cannot be run directly in SQLite because it requires
-- table recreation. Use run-migration-055-normalize-address-ids.js instead.

-- Expected transformations:
-- province_id: INTEGER → TEXT (2 digits, e.g., 11 → "11")
-- district_id: INTEGER → TEXT (3 digits, e.g., 107 → "107")  
-- ward_id: INTEGER → TEXT (5 digits, e.g., 1756 → "01756")

-- Benefits:
-- 1. Consistent format with tree.json (no more padding/unpadding)
-- 2. No type conversion needed in frontend
-- 3. Easier to maintain and debug
-- 4. Prevents race conditions from setTimeout hacks

-- Run with: node database/run-migration-055-normalize-address-ids.js

@echo off
echo ========================================
echo Add Unix Timestamp to CTV Table
echo ========================================
echo.
echo This migration will:
echo 1. Add created_at_unix column to ctv table
echo 2. Migrate existing data from created_at
echo 3. Create index for better performance
echo.
pause

wrangler d1 execute vdt --remote --file=030_add_unix_timestamp_to_ctv.sql

echo.
echo ========================================
echo Migration completed!
echo ========================================
pause

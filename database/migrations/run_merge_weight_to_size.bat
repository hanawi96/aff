@echo off
echo ========================================
echo Merge Weight to Size Migration
echo ========================================
echo.
echo This will:
echo 1. Copy all weight data to size column
echo 2. Drop the weight column from order_items
echo.
echo WARNING: This is irreversible!
echo.
pause

wrangler d1 execute ctv-management-db --remote --file=019_merge_weight_to_size.sql

echo.
echo ========================================
echo Migration completed!
echo ========================================
echo.
echo Verifying data...
wrangler d1 execute ctv-management-db --remote --command="SELECT id, product_name, size FROM order_items LIMIT 10"

pause

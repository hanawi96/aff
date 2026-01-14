@echo off
REM Check database statistics before migration

echo ========================================
echo Database Statistics Report
echo ========================================
echo.

echo Checking CTV table...
npx wrangler d1 execute vdt --remote --command="SELECT COUNT(*) as count FROM ctv"
echo.

echo Checking Orders table...
npx wrangler d1 execute vdt --remote --command="SELECT COUNT(*) as count FROM orders"
echo.

echo Checking Order Items table...
npx wrangler d1 execute vdt --remote --command="SELECT COUNT(*) as count FROM order_items"
echo.

echo Checking Products table...
npx wrangler d1 execute vdt --remote --command="SELECT COUNT(*) as count FROM products"
echo.

echo Checking Categories table...
npx wrangler d1 execute vdt --remote --command="SELECT COUNT(*) as count FROM categories"
echo.

echo Checking Customers table...
npx wrangler d1 execute vdt --remote --command="SELECT COUNT(*) as count FROM customers"
echo.

echo Checking Discounts table...
npx wrangler d1 execute vdt --remote --command="SELECT COUNT(*) as count FROM discounts"
echo.

echo Checking Users table...
npx wrangler d1 execute vdt --remote --command="SELECT COUNT(*) as count FROM users"
echo.

echo ========================================
echo Report completed!
echo ========================================

pause

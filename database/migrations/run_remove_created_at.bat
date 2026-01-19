@echo off
echo ========================================
echo Migration 037: Remove created_at column
echo ========================================
echo.

REM Get database name from wrangler.toml
for /f "tokens=2 delims==" %%a in ('findstr /C:"database_name" wrangler.toml') do set DB_NAME=%%a
set DB_NAME=%DB_NAME: =%
set DB_NAME=%DB_NAME:"=%

echo Database: %DB_NAME%
echo.

echo Step 1: Verify all orders have created_at_unix...
wrangler d1 execute %DB_NAME% --local --command="SELECT COUNT(*) as missing_timestamps FROM orders WHERE created_at_unix IS NULL;"
echo.

echo Step 2: Backup current orders table...
wrangler d1 execute %DB_NAME% --local --command="CREATE TABLE orders_backup AS SELECT * FROM orders;"
echo.

echo Step 3: Running migration...
wrangler d1 execute %DB_NAME% --local --file=database/migrations/037_remove_created_at_column.sql
echo.

echo Step 4: Verify migration...
wrangler d1 execute %DB_NAME% --local --command="SELECT COUNT(*) as total_orders, MIN(created_at_unix) as oldest, MAX(created_at_unix) as newest FROM orders;"
echo.

echo ========================================
echo Migration completed!
echo ========================================
pause

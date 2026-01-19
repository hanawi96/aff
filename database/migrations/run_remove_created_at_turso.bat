@echo off
echo ========================================
echo Migration 037: Remove created_at column (Turso)
echo ========================================
echo.

REM Read database name from .env
for /f "tokens=2 delims==" %%a in ('findstr /C:"TURSO_DATABASE_URL" .env') do set DB_URL=%%a
for /f "tokens=3 delims=/" %%a in ("%DB_URL%") do set DB_NAME=%%a

echo Database: %DB_NAME%
echo.

echo Step 1: Verify all orders have created_at_unix...
turso db shell %DB_NAME% "SELECT COUNT(*) as total_orders, COUNT(created_at_unix) as orders_with_unix_timestamp, COUNT(*) - COUNT(created_at_unix) as missing_timestamps FROM orders;"
echo.

pause
echo.
echo Step 2: Create backup (optional but recommended)...
echo Creating backup table...
turso db shell %DB_NAME% "CREATE TABLE orders_backup_20260119 AS SELECT * FROM orders;"
echo Backup created: orders_backup_20260119
echo.

pause
echo.
echo Step 3: Drop created_at column...
turso db shell %DB_NAME% "ALTER TABLE orders DROP COLUMN created_at;"
echo Column dropped!
echo.

echo Step 4: Verify migration...
turso db shell %DB_NAME% "PRAGMA table_info(orders);"
echo.

echo Step 5: Check data integrity...
turso db shell %DB_NAME% "SELECT COUNT(*) as total_orders, MIN(created_at_unix) as oldest_timestamp, MAX(created_at_unix) as newest_timestamp FROM orders;"
echo.

echo ========================================
echo Migration completed successfully!
echo ========================================
echo.
echo To rollback (if needed):
echo turso db shell %DB_NAME% "DROP TABLE orders; ALTER TABLE orders_backup_20260119 RENAME TO orders;"
echo.
pause

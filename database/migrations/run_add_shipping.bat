@echo off
echo ========================================
echo Add Shipping Columns Migration
echo ========================================
echo.

echo Running on REMOTE database...
echo.

wrangler d1 execute DB --remote --file=database/migrations/013_add_shipping_to_orders.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Migration completed successfully!
    echo ========================================
    echo.
    echo Added columns:
    echo - shipping_fee: Amount charged to customer
    echo - shipping_cost: Actual cost paid to carrier
    echo.
) else (
    echo.
    echo ========================================
    echo Migration failed!
    echo ========================================
    echo.
)

pause

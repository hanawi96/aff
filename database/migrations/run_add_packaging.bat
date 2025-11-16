@echo off
echo ========================================
echo Add Packaging Cost Tracking Migration
echo ========================================
echo.

echo Running on REMOTE database...
echo.

wrangler d1 execute DB --remote --file=database/migrations/014_add_packaging_cost_to_orders.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Migration completed successfully!
    echo ========================================
    echo.
    echo Added columns:
    echo - packaging_cost: Total packaging cost
    echo - packaging_details: JSON breakdown
    echo.
) else (
    echo.
    echo ========================================
    echo Migration failed!
    echo ========================================
    echo.
)

pause

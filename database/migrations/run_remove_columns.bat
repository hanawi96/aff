@echo off
echo ========================================
echo   Remove Redundant Cost Columns
echo ========================================
echo.
echo This will remove the following columns from orders table:
echo - profit (will be calculated dynamically)
echo - packaging_cost (fixed at 4,000d)
echo - shipping_cost (fixed at 21,000d)
echo - packaging_details (not used)
echo.
echo WARNING: This action cannot be undone!
echo.
pause

echo.
echo Running migration...
echo.

wrangler d1 execute DB --file=./database/migrations/008_remove_redundant_cost_columns.sql --local

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Migration completed successfully!
    echo ========================================
    echo.
    echo Changes:
    echo - Removed 4 columns from orders table
    echo - Profit will now be calculated dynamically
    echo - Fixed costs: Packaging 4,000d + Shipping 21,000d
    echo.
    echo Next: Update your code to use COST_CONSTANTS
    echo.
) else (
    echo.
    echo ========================================
    echo   Migration failed!
    echo ========================================
    echo.
)

pause

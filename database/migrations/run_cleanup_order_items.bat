@echo off
echo ========================================
echo   Cleanup order_items Table
echo ========================================
echo.
echo This will remove the following columns from order_items table:
echo.
echo 1. profit      - Wrong logic (profit is order-level, not item-level)
echo 2. subtotal    - Redundant (= product_price x quantity)
echo 3. cost_total  - Redundant (= product_cost x quantity)
echo.
echo After migration, these values will be calculated dynamically:
echo - Item subtotal = product_price x quantity
echo - Item cost = product_cost x quantity
echo - Item gross profit = subtotal - cost
echo - Order net profit = SUM(gross profit) - shipping - packaging - tax - commission
echo.
echo WARNING: This action cannot be undone!
echo.
pause

echo.
echo Running migration...
echo.

wrangler d1 execute DB --file=./database/migrations/009_cleanup_order_items_table.sql --local

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Migration completed successfully!
    echo ========================================
    echo.
    echo Changes:
    echo - Removed 3 redundant columns from order_items
    echo - Table structure is now cleaner and more maintainable
    echo - All calculations will be done dynamically in code
    echo.
    echo Next: Update your code to calculate these values when needed
    echo.
) else (
    echo.
    echo ========================================
    echo   Migration failed!
    echo ========================================
    echo.
    echo Please check the error message above.
    echo.
)

pause

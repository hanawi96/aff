@echo off
echo ========================================
echo Running Migration: Add Discount to Orders
echo ========================================
echo.

wrangler d1 execute vdt --remote --file=026_add_discount_to_orders.sql

echo.
echo ========================================
echo Migration completed!
echo ========================================
pause

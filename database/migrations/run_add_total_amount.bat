@echo off
echo ========================================
echo Running Migration: Add total_amount to orders
echo ========================================
echo.

wrangler d1 execute vdt --local --file=database/migrations/021_add_total_amount_to_orders.sql

echo.
echo ========================================
echo Migration completed!
echo ========================================
pause

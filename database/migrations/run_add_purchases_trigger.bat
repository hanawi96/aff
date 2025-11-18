@echo off
echo ========================================
echo Running Migration: Add Purchases Trigger
echo ========================================
echo.

wrangler d1 execute vdt --remote --file=023_add_purchases_trigger.sql

echo.
echo ========================================
echo Migration Complete!
echo ========================================
pause

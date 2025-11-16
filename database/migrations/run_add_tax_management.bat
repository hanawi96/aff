@echo off
echo ========================================
echo Running Tax Management Migration
echo ========================================
echo.

wrangler d1 execute ctv-management-db --local --file=./016_add_tax_management.sql

echo.
echo ========================================
echo Migration completed!
echo ========================================
pause

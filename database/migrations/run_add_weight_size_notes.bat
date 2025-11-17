@echo off
echo ========================================
echo Running Migration: Add weight, size, notes to order_items
echo ========================================
echo.

wrangler d1 execute ctv-management-db --remote --file=022_add_weight_size_notes_to_order_items.sql

echo.
echo ========================================
echo Migration completed!
echo ========================================
pause

@echo off
echo Running migration 079: Add orders performance indexes...
node database/run-migration.js 079_add_orders_performance_indexes.sql

if %errorlevel% equ 0 (
    echo.
    echo Migration 079 completed.
) else (
    echo.
    echo Migration 079 failed!
    pause
    exit /b 1
)
pause

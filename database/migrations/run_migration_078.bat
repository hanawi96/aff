@echo off
echo Running migration 078: Add deposit_amount to orders...
node database/run-migration.js 078_add_deposit_amount_to_orders.sql

if %errorlevel% equ 0 (
    echo.
    echo Migration 078 completed.
) else (
    echo.
    echo Migration 078 failed!
    pause
    exit /b 1
)
pause

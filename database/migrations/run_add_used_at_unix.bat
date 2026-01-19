@echo off
echo Running migration: Add used_at_unix to discount_usage...
turso db shell vdt < database/migrations/044_add_used_at_unix_to_discount_usage.sql

if %errorlevel% equ 0 (
    echo.
    echo ✅ Migration completed successfully!
) else (
    echo.
    echo ❌ Migration failed!
    pause
    exit /b 1
)
pause

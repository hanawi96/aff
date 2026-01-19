@echo off
REM Run migration 045 to remove TEXT timestamp columns from products table

echo Running migration 045: Remove TEXT timestamp columns from products...
echo.

REM Get the database name from environment or use default
if "%TURSO_DB_NAME%"=="" (
    set TURSO_DB_NAME=shopvd-db
)

echo Database: %TURSO_DB_NAME%
echo.

REM Execute the migration
turso db shell %TURSO_DB_NAME% < 045_remove_text_timestamps_from_products.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Migration 045 completed successfully!
) else (
    echo.
    echo ❌ Migration failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

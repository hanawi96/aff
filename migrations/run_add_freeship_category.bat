@echo off
echo ========================================
echo   Add Freeship Category Migration
echo ========================================
echo.

REM Get database path from user or use default
set /p DB_PATH="Enter database path (or press Enter for default './database.db'): "
if "%DB_PATH%"=="" set DB_PATH=./database.db

echo.
echo Database: %DB_PATH%
echo.

REM Check if database exists
if not exist "%DB_PATH%" (
    echo ERROR: Database file not found: %DB_PATH%
    echo Please check the path and try again.
    pause
    exit /b 1
)

echo Running migration: 0008_add_freeship_category.sql
echo.

REM Run the migration
wrangler d1 execute DB --file=./migrations/0008_add_freeship_category.sql --local

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Migration completed successfully!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Update products to use category_id = 23 for Freeship items
    echo 2. Refresh the Orders page to see the changes
    echo.
) else (
    echo.
    echo ========================================
    echo   Migration failed!
    echo ========================================
    echo.
)

pause

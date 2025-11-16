@echo off
echo ========================================
echo Remove Weight and Size Columns Migration
echo ========================================
echo.

REM Get database path from wrangler.toml
for /f "tokens=2 delims==" %%a in ('findstr /C:"database_id" wrangler.toml') do set DB_ID=%%a
set DB_ID=%DB_ID:"=%
set DB_ID=%DB_ID: =%

if "%DB_ID%"=="" (
    echo Error: Could not find database_id in wrangler.toml
    pause
    exit /b 1
)

set DB_PATH=.wrangler\state\v3\d1\miniflare-D1DatabaseObject\%DB_ID%.sqlite

echo Database: %DB_PATH%
echo.

if not exist "%DB_PATH%" (
    echo Error: Database file not found at %DB_PATH%
    pause
    exit /b 1
)

echo Running migration: 012_remove_weight_size_columns.sql
echo.

REM Run the migration
wrangler d1 execute DB --local --file=database/migrations/012_remove_weight_size_columns.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Migration completed successfully!
    echo ========================================
    echo.
    echo Weight and size columns have been removed from products table.
    echo.
) else (
    echo.
    echo ========================================
    echo Migration failed!
    echo ========================================
    echo.
    echo Please check the error messages above.
    echo.
)

pause

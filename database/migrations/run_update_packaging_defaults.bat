@echo off
echo ========================================
echo Update Packaging Config Defaults
echo ========================================
echo.

REM Get database path from environment or use default
if "%DATABASE_PATH%"=="" (
    set DATABASE_PATH=.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b0f3ff7dd560fc511b90a820ed69b52a7cc47f05a42f43f2ef8456db159280a8.sqlite
)

echo Database: %DATABASE_PATH%
echo.

REM Check if database exists
if not exist "%DATABASE_PATH%" (
    echo ERROR: Database file not found!
    echo Path: %DATABASE_PATH%
    pause
    exit /b 1
)

echo Running migration: 015_update_cost_config_defaults.sql
echo.

REM Run migration
wrangler d1 execute ctv-management --local --file=database/migrations/015_update_cost_config_defaults.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Migration completed successfully!
    echo ========================================
    echo.
    echo Checking results...
    echo.
    
    REM Show current cost config
    wrangler d1 execute ctv-management --local --command="SELECT item_name, item_cost, is_default FROM cost_config ORDER BY is_default DESC, item_name"
    
    echo.
    echo Expected for 1 product:
    echo - Per-Product: bag_zip (500) + bag_red (1000) = 1500đ
    echo - Per-Order: box_shipping (3000) + thank_card (300) = 3300đ
    echo - Total: (1500 × 1) + 3300 = 4800đ
    echo.
) else (
    echo.
    echo ========================================
    echo Migration FAILED!
    echo ========================================
    echo.
)

pause

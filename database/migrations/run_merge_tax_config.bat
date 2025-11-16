@echo off
echo ========================================
echo Merge tax_config into cost_config
echo ========================================
echo.

REM Get the directory where the script is located
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..\..

REM Change to project root
cd /d "%PROJECT_ROOT%"

echo Running migration: 017_merge_tax_into_packaging_config.sql
echo.

REM Run the migration using wrangler d1 execute
npx wrangler d1 execute order-management-db --local --file=database/migrations/017_merge_tax_into_packaging_config.sql

echo.
echo ========================================
echo Migration completed!
echo ========================================
echo.
echo Next steps:
echo 1. Verify the data in cost_config table
echo 2. Update worker.js to use cost_config instead of tax_config
echo 3. Test the tax calculation functionality
echo.

pause

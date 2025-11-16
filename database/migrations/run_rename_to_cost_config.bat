@echo off
echo ========================================
echo Rename packaging_config to cost_config
echo ========================================
echo.

REM Get the project root directory (2 levels up from migrations folder)
set "PROJECT_ROOT=%~dp0..\.."

REM Change to project root
cd /d "%PROJECT_ROOT%"

echo Running migration: 019_rename_packaging_config_to_cost_config.sql
echo.

REM Run the migration using wrangler d1 execute
npx wrangler d1 execute order-management-db --local --file=database/migrations/019_rename_packaging_config_to_cost_config.sql

echo.
echo Migration completed!
echo.
echo Next steps:
echo 1. Verify the data in cost_config table
echo 2. Test all functionality that uses cost_config
echo 3. Deploy to production if needed
echo.

pause

@echo off
echo ========================================
echo Running Migration: Add Bank Info to CTV
echo ========================================
echo.

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: wrangler is not installed or not in PATH
    echo Please install wrangler: npm install -g wrangler
    pause
    exit /b 1
)

echo Running migration...
wrangler d1 execute ctv-management --file=add_bank_info_to_ctv.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Migration completed successfully!
    echo ========================================
    echo.
    echo Added columns:
    echo - bank_account_number (TEXT)
    echo - bank_name (TEXT)
    echo.
) else (
    echo.
    echo ========================================
    echo Migration failed!
    echo ========================================
    echo.
)

pause

@echo off
echo ========================================
echo Checking and Fixing Bank Columns
echo ========================================
echo.

REM Check if columns exist
echo Checking if bank columns exist...
wrangler d1 execute ctv-management --command="SELECT bank_account_number, bank_name FROM ctv LIMIT 1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Columns not found! Running migration...
    echo.
    cd migrations
    wrangler d1 execute ctv-management --file=add_bank_info_to_ctv.sql
    cd ..
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ========================================
        echo Migration completed successfully!
        echo ========================================
    ) else (
        echo.
        echo ========================================
        echo Migration failed!
        echo ========================================
    )
) else (
    echo.
    echo ========================================
    echo Bank columns already exist!
    echo ========================================
)

echo.
pause

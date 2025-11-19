@echo off
echo ========================================
echo Checking Latest CTV Bank Info
echo ========================================
echo.

echo Fetching latest 5 CTVs with bank info...
echo.

wrangler d1 execute ctv-management --command="SELECT referral_code, full_name, phone, bank_account_number, bank_name, created_at FROM ctv ORDER BY created_at DESC LIMIT 5"

echo.
echo ========================================
echo.
pause

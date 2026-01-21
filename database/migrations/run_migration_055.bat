@echo off
echo ========================================
echo Running Migration 055
echo Normalize Address IDs to String Format
echo ========================================
echo.
echo This will convert address IDs from INTEGER to TEXT:
echo - province_id: 2 digits (e.g., 11 -^> "11")
echo - district_id: 3 digits (e.g., 107 -^> "107")
echo - ward_id: 5 digits (e.g., 1756 -^> "01756")
echo.
echo WARNING: This will recreate the orders table!
echo Make sure you have a backup before proceeding.
echo.
pause

cd ..
node run-migration-055-normalize-address-ids.js

echo.
echo ========================================
echo Migration completed!
echo ========================================
pause

@echo off
echo ========================================
echo UTC Timestamp Migration
echo ========================================
echo.
echo This will standardize all timestamps to UTC format
echo Frontend will handle timezone conversion to Vietnam (UTC+7)
echo.
pause

echo.
echo Running migration...
wrangler d1 execute order-management-db --local --file=database/migrations/018_standardize_utc_timestamps.sql

echo.
echo ========================================
echo Migration completed!
echo ========================================
echo.
echo Next steps:
echo 1. Test locally to verify timestamps are correct
echo 2. Deploy to production: wrangler d1 execute order-management-db --remote --file=database/migrations/018_standardize_utc_timestamps.sql
echo.
pause

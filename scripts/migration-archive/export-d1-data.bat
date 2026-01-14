@echo off
REM Export Cloudflare D1 database to SQL file
REM Run this before migrating to Turso

echo ========================================
echo Exporting D1 Database to SQL
echo ========================================
echo.

REM Create backups directory if not exists
if not exist "backups" mkdir backups

REM Get current date for filename
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set datetime=%mydate%_%mytime%

REM Export full database
echo Exporting full database...
npx wrangler d1 export vdt --output=backups/d1_backup_%datetime%.sql

echo.
echo ========================================
echo Export completed!
echo File: backups/d1_backup_%datetime%.sql
echo ========================================
echo.
echo Next steps:
echo 1. Review the exported SQL file
echo 2. Create Turso database: turso db create vdt-production
echo 3. Import to Turso: turso db shell vdt-production ^< backups/d1_backup_%datetime%.sql
echo.

pause

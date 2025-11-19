@echo off
echo ========================================
echo Deploying Worker with Debug Logs
echo ========================================
echo.

echo Deploying to Cloudflare...
wrangler deploy

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Deploy successful!
    echo ========================================
    echo.
    echo Now test by adding a new CTV with bank info.
    echo Then check logs with:
    echo   wrangler tail
    echo.
    echo Or view logs in Cloudflare Dashboard:
    echo   https://dash.cloudflare.com
    echo.
) else (
    echo.
    echo ========================================
    echo Deploy failed!
    echo ========================================
)

pause

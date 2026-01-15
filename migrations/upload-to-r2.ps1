# PowerShell script to upload images to R2
Write-Host "Starting R2 upload to REMOTE..." -ForegroundColor Green
Write-Host ""

$commands = Get-Content "migrations\r2-upload-commands.sh"
$total = $commands.Count
$current = 0
$success = 0
$failed = 0

foreach ($cmd in $commands) {
    $current++
    $percent = [math]::Round(($current / $total) * 100)
    
    Write-Host "[$current/$total] ($percent%) Uploading..." -ForegroundColor Cyan
    
    # Add --remote flag to upload to production
    $remoteCmd = $cmd + " --remote"
    
    try {
        Invoke-Expression $remoteCmd 2>&1 | Out-Null
        $success++
        Write-Host "Success" -ForegroundColor Green
    } catch {
        $failed++
        Write-Host "Failed: $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Upload Summary:" -ForegroundColor Yellow
Write-Host "   Total:   $total files" -ForegroundColor White
Write-Host "   Success: $success files" -ForegroundColor Green
Write-Host "   Failed:  $failed files" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

if ($failed -eq 0) {
    Write-Host "All images uploaded successfully!" -ForegroundColor Green
    Write-Host "Verify: wrangler r2 object get vdt-image/assets/images/banner.webp --remote" -ForegroundColor Cyan
} else {
    Write-Host "Some uploads failed. Please check and retry." -ForegroundColor Yellow
}

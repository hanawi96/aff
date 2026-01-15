# Fix R2 files with spaces
Write-Host "Fixing R2 files with spaces..." -ForegroundColor Green
Write-Host ""

$commands = Get-Content "migrations\r2-fix-spaces-commands.sh"
$total = $commands.Count
$current = 0
$success = 0
$failed = 0

foreach ($cmd in $commands) {
    $current++
    $percent = [math]::Round(($current / $total) * 100)
    
    Write-Host "[$current/$total] ($percent%) Uploading..." -ForegroundColor Cyan
    
    try {
        Invoke-Expression $cmd 2>&1 | Out-Null
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
    Write-Host "All files uploaded successfully!" -ForegroundColor Green
    Write-Host "Next step: node scripts/update-r2-fixed-urls.js" -ForegroundColor Cyan
} else {
    Write-Host "Some uploads failed. Please check and retry." -ForegroundColor Yellow
}

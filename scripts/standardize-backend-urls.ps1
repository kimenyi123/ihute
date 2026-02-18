# Backend URL Standardization Script
# This script updates all route.ts files to use JAVA_BACKEND_BASE from .env.local

Write-Host "Backend URL Standardization Tool" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$routeFiles = Get-ChildItem -Path "app\api" -Filter "route.ts" -Recurse -File
$updateCount = 0

foreach ($file in $routeFiles) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $updated = $false
    
    # Pattern 1: Fix JAVA_BACKEND_BASE with localhost fallback
    if ($content -match 'JAVA_BACKEND_BASE\s*=\s*process\.env\.JAVA_BACKEND_BASE\s*\|\|\s*["\']http://localhost:8080["\']') {
        $content = $content -replace '(JAVA_BACKEND_BASE\s*=\s*process\.env\.JAVA_BACKEND_BASE\s*\|\|\s*)["\']http://localhost:8080["\']', '$1"http://localhost:8080/Trading"'
        $updated = $true
    }
    
    # Pattern 2: Convert single quotes to double quotes for consistency
    if ($content -match "JAVA_BACKEND_BASE\s*=\s*process\.env\.JAVA_BACKEND_BASE\s*\|\|\s*'http://localhost:8080/Trading'") {
        $content = $content -replace "(JAVA_BACKEND_BASE\s*=\s*process\.env\.JAVA_BACKEND_BASE\s*\|\|\s*)'([^']+)'", '$1"$2"'
        $updated = $true
    }
    
    # Pattern 3: Rename JAVA_BACKEND_BASE to BACKEND_URL for consistency
    if ($content -match 'const JAVA_BACKEND_BASE') {
        $content = $content -replace 'const JAVA_BACKEND_BASE', 'const BACKEND_URL'
        $content = $content -replace '\$\{JAVA_BACKEND_BASE\}', '${BACKEND_URL}'
        $content = $content -replace 'JAVA_BACKEND_BASE', 'BACKEND_URL'
        $updated = $true
    }
    
    if ($updated) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "✓ Updated: $($file.FullName.Replace((Get-Location).Path, '.'))" -ForegroundColor Green
        $updateCount++
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Total route.ts files found: $($routeFiles.Count)" -ForegroundColor Yellow
Write-Host "  Files updated: $updateCount" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review changes with: git diff" -ForegroundColor White
Write-Host "  2. Test in development mode" -ForegroundColor White
Write-Host "  3. Verify .env.local has JAVA_BACKEND_BASE set correctly" -ForegroundColor White

# update-theme.ps1 - Run this in frontend-admin folder

Write-Host "Updating Admin Panel Theme to VexaTrade..." -ForegroundColor Cyan

$files = Get-ChildItem -Path "src" -Recurse -Include "*.jsx", "*.css"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)" -ForegroundColor Yellow
    $content = Get-Content $file.FullName -Raw
    
    # Background colors
    $content = $content -replace 'bg-slate-950', 'bg-[#050812]'
    $content = $content -replace 'bg-slate-900/70', 'bg-[#0a0e1a]'
    $content = $content -replace 'bg-slate-900/80', 'bg-[#0a0e1a]/90'
    $content = $content -replace 'bg-slate-800', 'bg-[#0a0e1a]'
    $content = $content -replace 'bg-slate-900', 'bg-[#0a0e1a]'
    
    # Accent colors (violet/purple to cyan)
    $content = $content -replace 'violet-', 'cyan-'
    $content = $content -replace 'purple-', 'cyan-'
    $content = $content -replace 'text-violet-300', 'text-cyan-300'
    $content = $content -replace 'text-violet-400', 'text-cyan-400'
    $content = $content -replace 'border-violet-500', 'border-cyan-500'
    $content = $content -replace 'border-violet-400', 'border-cyan-400'
    $content = $content -replace 'bg-violet-500', 'bg-cyan-500'
    $content = $content -replace 'bg-violet-600', 'bg-cyan-600'
    $content = $content -replace 'hover:bg-violet-400', 'hover:bg-cyan-400'
    $content = $content -replace 'hover:bg-violet-500', 'hover:bg-cyan-500'
    $content = $content -replace 'ring-violet-500', 'ring-cyan-500'
    
    # Brand name
    $content = $content -replace 'CryptoPulse', 'VexaTrade'
    $content = $content -replace 'CRYPTOPULSE', 'VEXATRADE'
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "`n✅ Admin theme update complete!" -ForegroundColor Green
Write-Host "Run 'npm run dev' to test the changes." -ForegroundColor Yellow
# update-theme.ps1 - Run this in frontend-user folder

Write-Host "Updating User Panel Theme to VexaTrade..." -ForegroundColor Cyan

$files = Get-ChildItem -Path "src" -Recurse -Include "*.jsx", "*.css"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)" -ForegroundColor Yellow
    $content = Get-Content $file.FullName -Raw
    
    # Background colors
    $content = $content -replace 'bg-black', 'bg-[#050812]'
    $content = $content -replace 'bg-\[#111111\]', 'bg-[#0a0e1a]'
    $content = $content -replace 'bg-\[#0f0f0f\]', 'bg-[#0a0e1a]'
    $content = $content -replace 'bg-\[#141414\]', 'bg-[#0a0e1a]'
    $content = $content -replace 'bg-\[#171717\]', 'bg-[#0a0e1a]'
    $content = $content -replace 'bg-slate-900/70', 'bg-[#0a0e1a]/80'
    $content = $content -replace 'bg-slate-900/80', 'bg-[#0a0e1a]/90'
    
    # Accent colors (lime to cyan)
    $content = $content -replace 'lime-400', 'cyan-500'
    $content = $content -replace 'lime-300', 'cyan-400'
    $content = $content -replace 'lime-500', 'cyan-500'
    $content = $content -replace 'bg-lime-400', 'bg-cyan-500'
    $content = $content -replace 'hover:bg-lime-300', 'hover:bg-cyan-400'
    $content = $content -replace 'hover:bg-lime-400', 'hover:bg-cyan-500'
    $content = $content -replace 'text-lime-300', 'text-cyan-400'
    $content = $content -replace 'text-lime-400', 'text-cyan-400'
    $content = $content -replace 'border-lime-400', 'border-cyan-500'
    $content = $content -replace 'border-lime-500', 'border-cyan-500'
    $content = $content -replace 'from-lime-400', 'from-cyan-400'
    $content = $content -replace 'to-lime-500', 'to-cyan-500'
    $content = $content -replace 'ring-lime-400', 'ring-cyan-500'
    
    # Brand name
    $content = $content -replace 'CryptoPulse', 'VexaTrade'
    $content = $content -replace 'CRYPTOPULSE', 'VEXATRADE'
    $content = $content -replace 'cryptopulse', 'vexatrade'
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "`n✅ User theme update complete!" -ForegroundColor Green
Write-Host "Run 'npm run dev' to test the changes." -ForegroundColor Yellow
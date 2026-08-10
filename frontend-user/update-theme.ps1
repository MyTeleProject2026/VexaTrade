# update-theme.ps1 - SAFER VERSION
Write-Host "Updating User Panel Theme to VexaTrade..." -ForegroundColor Cyan

$files = Get-ChildItem -Path "src" -Recurse -Include "*.jsx", "*.css"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)" -ForegroundColor Yellow
    $content = Get-Content $file.FullName -Raw -Encoding UTF8

    # Background colors (more precise regex to avoid partial matches)
    $content = $content -replace '(?<![a-zA-Z-])bg-black\b', 'bg-[#050812]'
    $content = $content -replace '(?<![a-zA-Z-])bg-\[#111111\]', 'bg-[#0a0e1a]'
    $content = $content -replace '(?<![a-zA-Z-])bg-\[#0f0f0f\]', 'bg-[#0a0e1a]'
    $content = $content -replace '(?<![a-zA-Z-])bg-\[#141414\]', 'bg-[#0a0e1a]'
    $content = $content -replace '(?<![a-zA-Z-])bg-\[#171717\]', 'bg-[#0a0e1a]'
    $content = $content -replace 'bg-slate-900/70', 'bg-[#0a0e1a]/80'
    $content = $content -replace 'bg-slate-900/80', 'bg-[#0a0e1a]/90'

    # Accent colors (lime to cyan) – more precise to avoid matching "lime-400" in a class like "hover:lime-400" etc.
    $content = $content -replace '(?<![a-zA-Z-])lime-400\b', 'cyan-500'
    $content = $content -replace '(?<![a-zA-Z-])lime-300\b', 'cyan-400'
    $content = $content -replace '(?<![a-zA-Z-])lime-500\b', 'cyan-500'
    # Backgrounds
    $content = $content -replace '(?<![a-zA-Z-])bg-lime-400\b', 'bg-cyan-500'
    $content = $content -replace 'hover:bg-lime-300', 'hover:bg-cyan-400'
    $content = $content -replace 'hover:bg-lime-400', 'hover:bg-cyan-500'
    # Text
    $content = $content -replace '(?<![a-zA-Z-])text-lime-300\b', 'text-cyan-400'
    $content = $content -replace '(?<![a-zA-Z-])text-lime-400\b', 'text-cyan-400'
    # Borders
    $content = $content -replace '(?<![a-zA-Z-])border-lime-400\b', 'border-cyan-500'
    $content = $content -replace '(?<![a-zA-Z-])border-lime-500\b', 'border-cyan-500'
    # Gradients
    $content = $content -replace 'from-lime-400', 'from-cyan-400'
    $content = $content -replace 'to-lime-500', 'to-cyan-500'
    # Ring
    $content = $content -replace 'ring-lime-400', 'ring-cyan-500'

    # Brand name – more precise to avoid partial matches
    $content = $content -replace '\bCryptoPulse\b', 'VexaTrade'
    $content = $content -replace '\bCRYPTOPULSE\b', 'VEXATRADE'
    $content = $content -replace '\bcryptopulse\b', 'vexatrade'

    # Write with UTF8 encoding and keep newline
    $content | Out-File -FilePath $file.FullName -Encoding UTF8 -NoNewline $false
}

Write-Host "`n✅ User theme update complete!" -ForegroundColor Green
Write-Host "Run 'npm run dev' to test the changes." -ForegroundColor Yellow

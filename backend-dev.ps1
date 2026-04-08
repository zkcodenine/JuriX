# Roda SOMENTE o backend (use em terminais separados)
Set-Location "$PSScriptRoot\backend"
Write-Host "[JuriX Backend] Iniciando na porta 3001..." -ForegroundColor Yellow
npm run dev

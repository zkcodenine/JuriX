# Roda SOMENTE o frontend (use em terminais separados)
Set-Location "$PSScriptRoot\frontend"
Write-Host "[JuriX Frontend] Iniciando na porta 3000..." -ForegroundColor Yellow
npm run dev

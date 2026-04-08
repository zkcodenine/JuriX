# ════════════════════════════════════════════════════
#  JuriX — Iniciar em modo desenvolvimento
#  Abre dois terminais: Backend + Frontend
#  Execute: .\dev.ps1
# ════════════════════════════════════════════════════

Write-Host ""
Write-Host "  [JuriX] Iniciando sistema em desenvolvimento..." -ForegroundColor Yellow
Write-Host ""

$root = Get-Location

# ─── Inicia Backend em novo terminal ──────────────
Write-Host "  → Abrindo terminal do Backend (porta 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root\backend'; Write-Host ' JuriX Backend' -ForegroundColor Yellow; npm run dev"
)

Start-Sleep -Seconds 2

# ─── Inicia Frontend em novo terminal ─────────────
Write-Host "  → Abrindo terminal do Frontend (porta 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root\frontend'; Write-Host ' JuriX Frontend' -ForegroundColor Yellow; npm run dev"
)

Write-Host ""
Write-Host "  ✓ Dois terminais abertos!" -ForegroundColor Green
Write-Host ""
Write-Host "  Aguarde alguns segundos e acesse:" -ForegroundColor White
Write-Host "  Frontend → http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend  → http://localhost:3001/health" -ForegroundColor Cyan
Write-Host ""

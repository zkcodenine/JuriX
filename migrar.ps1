# ════════════════════════════════════════════════════
#  JuriX — Criar/Atualizar tabelas no banco
#  Execute: .\migrar.ps1
# ════════════════════════════════════════════════════

Write-Host ""
Write-Host "  [JuriX] Rodando migrations do banco..." -ForegroundColor Cyan
Write-Host ""

Set-Location backend

# Gera o Prisma Client
Write-Host "  Gerando Prisma Client..." -ForegroundColor DarkGray
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Falha ao gerar Prisma Client" -ForegroundColor Red; Set-Location ..; exit 1 }

# Roda as migrations
Write-Host ""
Write-Host "  Aplicando migrations..." -ForegroundColor DarkGray
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    # Tenta db push como alternativa (para Supabase/projetos novos)
    Write-Host "  Tentando prisma db push..." -ForegroundColor Yellow
    npx prisma db push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Falha nas migrations. Verifique o DATABASE_URL no backend\.env" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

Set-Location ..

Write-Host ""
Write-Host "  ✓ Banco de dados atualizado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "  Agora rode: .\dev.ps1" -ForegroundColor Cyan
Write-Host ""

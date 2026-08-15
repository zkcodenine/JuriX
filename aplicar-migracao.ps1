# ════════════════════════════════════════════════════
#  JuriX — Aplicar a migração dos ANEXOS no banco
#  Cria a tabela documentos_conteudo (bytes dos anexos no
#  MySQL compartilhado). Rode UMA VEZ, com o backend\.env
#  já apontando para o banco de produção.
#  Execute na raiz do projeto: .\aplicar-migracao.ps1
# ════════════════════════════════════════════════════

$root = $PSScriptRoot
$sql  = "prisma\manual-migrations\2026-08-14_documentos_conteudo.sql"

Write-Host ""
Write-Host "  [JuriX] Migração — tabela de anexos (documentos_conteudo)" -ForegroundColor Yellow
Write-Host "  ════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Este script SÓ CRIA UMA TABELA NOVA (CREATE TABLE)." -ForegroundColor White
Write-Host "  Não há DROP nem ALTER — as tabelas cards_* do 'Cards de Saúde'" -ForegroundColor White
Write-Host "  NÃO são tocadas." -ForegroundColor White
Write-Host ""
Write-Host "  ⚠  NÃO use .\migrar.ps1 para isto: o fallback dele é 'prisma db" -ForegroundColor Yellow
Write-Host "     push', que geraria DROP nas tabelas do Cards de Saúde." -ForegroundColor Yellow
Write-Host ""

Set-Location "$root\backend"

if (-not (Test-Path $sql)) {
    Write-Host "  ✗ Arquivo de migração não encontrado: backend\$sql" -ForegroundColor Red
    Set-Location $root; exit 1
}

# ─── Aplica o SQL aditivo (caminho SEGURO, sem db push) ──
Write-Host "  Aplicando $sql ..." -ForegroundColor Cyan
npx prisma db execute --schema prisma/schema.prisma --file $sql
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Falha ao aplicar a migração." -ForegroundColor Red
    Write-Host "    Confira o DATABASE_URL em backend\.env e o IP liberado em" -ForegroundColor Yellow
    Write-Host "    cPanel > Remote MySQL." -ForegroundColor Yellow
    Set-Location $root; exit 1
}
Write-Host "  ✓ Tabela documentos_conteudo criada (ou já existia)" -ForegroundColor Green

# ─── Regenera o client (garante o modelo novo) ──────
Write-Host ""
Write-Host "  Regenerando Prisma Client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Falha ao gerar Prisma Client" -ForegroundColor Red; Set-Location $root; exit 1 }

Set-Location $root
Write-Host ""
Write-Host "  ✓ Migração concluída. Os anexos agora ficam no banco e são" -ForegroundColor Green
Write-Host "    visíveis para os usuários de um processo compartilhado." -ForegroundColor Green
Write-Host ""

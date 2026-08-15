# ════════════════════════════════════════════════════
#  JuriX — Build do instalador (.exe) do zero
#  Instala dependências, gera o Prisma Client e empacota
#  o Electron. NÃO toca no banco de dados.
#  Execute na raiz do projeto: .\build.ps1
# ════════════════════════════════════════════════════

$root = $PSScriptRoot

Write-Host ""
Write-Host "  [JuriX] Build do instalador" -ForegroundColor Yellow
Write-Host "  ════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# ─── [1/5] Node.js ─────────────────────────────────
Write-Host "  [1/5] Verificando Node.js..." -ForegroundColor Cyan
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Node.js não encontrado! Baixe em: https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green

# ─── [2/5] Dependências (raiz, backend, frontend) ──
Write-Host ""
Write-Host "  [2/5] Instalando dependências (pode demorar na 1ª vez)..." -ForegroundColor Cyan

Set-Location $root
Write-Host "    → raiz (Electron / electron-builder)..." -ForegroundColor DarkGray
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Falha no npm install (raiz)" -ForegroundColor Red; Set-Location $root; exit 1 }

Set-Location "$root\backend"
Write-Host "    → backend..." -ForegroundColor DarkGray
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Falha no npm install (backend)" -ForegroundColor Red; Set-Location $root; exit 1 }

Set-Location "$root\frontend"
Write-Host "    → frontend..." -ForegroundColor DarkGray
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Falha no npm install (frontend)" -ForegroundColor Red; Set-Location $root; exit 1 }
Write-Host "  ✓ Dependências instaladas" -ForegroundColor Green

# ─── [3/5] Prisma Client ───────────────────────────
# Gera o client (inclui o novo modelo DocumentoConteudo) para ir empacotado
# com o backend. Passo LOCAL — não acessa o banco.
Write-Host ""
Write-Host "  [3/5] Gerando Prisma Client..." -ForegroundColor Cyan
Set-Location "$root\backend"
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Falha ao gerar Prisma Client" -ForegroundColor Red; Set-Location $root; exit 1 }
Write-Host "  ✓ Prisma Client gerado" -ForegroundColor Green

# ─── Limpa builds antigas (economiza espaço) ───────
# Apaga a saída anterior inteira antes de empacotar. O electron-builder
# recria tudo; assim a pasta guarda apenas a versão ATUAL.
if (Test-Path "$root\dist-electron") {
    Write-Host ""
    Write-Host "  Limpando builds antigas em dist-electron\ ..." -ForegroundColor DarkGray
    try { Remove-Item "$root\dist-electron\*" -Recurse -Force -ErrorAction Stop; Write-Host "  ✓ dist-electron limpo" -ForegroundColor Green }
    catch { Write-Host "  ⚠ Não consegui limpar tudo (arquivo em uso?)" -ForegroundColor Yellow }
}

# ─── [4/5] Empacotar (frontend + Electron) ─────────
Write-Host ""
Write-Host "  [4/5] Compilando frontend e empacotando o Electron..." -ForegroundColor Cyan
Set-Location $root
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Falha no empacotamento (npm run build)" -ForegroundColor Red; Set-Location $root; exit 1 }

# ─── [5/5] Localizar o instalador ──────────────────
Write-Host ""
Write-Host "  [5/5] Procurando o instalador gerado..." -ForegroundColor Cyan
$exe = Get-ChildItem -Path "$root\dist-electron" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1

Set-Location $root
Write-Host ""
if ($exe) {
    $mb = [math]::Round($exe.Length / 1MB, 1)
    Write-Host "  ✓ Instalador pronto!" -ForegroundColor Green
    Write-Host "    $($exe.FullName)  ($mb MB)" -ForegroundColor White
} else {
    Write-Host "  ⚠ Build terminou, mas não achei *Setup*.exe em dist-electron\." -ForegroundColor Yellow
    Write-Host "    Confira a saída acima do electron-builder." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Lembre: para os ANEXOS compartilhados funcionarem, rode uma vez" -ForegroundColor Cyan
Write-Host "  a migração do banco:  .\aplicar-migracao.ps1" -ForegroundColor Cyan
Write-Host ""

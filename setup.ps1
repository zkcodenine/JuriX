# ════════════════════════════════════════════════════
#  JuriX — Setup Inicial (PowerShell)
#  Execute: .\setup.ps1
# ════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ██╗██╗   ██╗██████╗ ██╗██╗  ██╗" -ForegroundColor Yellow
Write-Host "  ██║██║   ██║██╔══██╗██║╚██╗██╔╝" -ForegroundColor Yellow
Write-Host "  ██║██║   ██║██████╔╝██║ ╚███╔╝ " -ForegroundColor Yellow
Write-Host "  ██║██║   ██║██╔══██╗██║ ██╔██╗ " -ForegroundColor Yellow
Write-Host "  ██║╚██████╔╝██║  ██║██║██╔╝ ██╗" -ForegroundColor Yellow
Write-Host "  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Sistema Jurídico — Setup" -ForegroundColor Cyan
Write-Host "════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# ─── Verifica Node.js ──────────────────────────────
Write-Host "  [1/4] Verificando Node.js..." -ForegroundColor Cyan
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Node.js não encontrado! Baixe em: https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green

# ─── Instala dependências do backend ──────────────
Write-Host ""
Write-Host "  [2/4] Instalando dependências do Backend..." -ForegroundColor Cyan
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Falha no npm install (backend)" -ForegroundColor Red; exit 1 }
Write-Host "  ✓ Backend instalado" -ForegroundColor Green

# ─── Cria pastas necessárias ──────────────────────
New-Item -ItemType Directory -Force -Path "..\storage\documentos" | Out-Null
New-Item -ItemType Directory -Force -Path "..\logs" | Out-Null
Write-Host "  ✓ Pastas storage/ e logs/ criadas" -ForegroundColor Green

Set-Location ..

# ─── Instala dependências do frontend ─────────────
Write-Host ""
Write-Host "  [3/4] Instalando dependências do Frontend..." -ForegroundColor Cyan
Set-Location frontend
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ Falha no npm install (frontend)" -ForegroundColor Red; exit 1 }
Write-Host "  ✓ Frontend instalado" -ForegroundColor Green
Set-Location ..

# ─── Instrução banco de dados ─────────────────────
Write-Host ""
Write-Host "  [4/4] Configuração do banco de dados (HostGator MySQL)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ┌───────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "  │  Banco: MySQL HostGator                                   │" -ForegroundColor Yellow
Write-Host "  │                                                            │" -ForegroundColor DarkGray
Write-Host "  │  1. cPanel HostGator > MySQL Databases:                   │" -ForegroundColor White
Write-Host "  │     - Crie o banco (ex: cpaneluser_jurix)                 │" -ForegroundColor White
Write-Host "  │     - Crie o usuário e associe ao banco com ALL PRIVS     │" -ForegroundColor White
Write-Host "  │                                                            │" -ForegroundColor DarkGray
Write-Host "  │  2. cPanel > Remote MySQL:                                │" -ForegroundColor White
Write-Host "  │     - Adicione o IP do servidor JuriX (ou % para qualquer)│" -ForegroundColor White
Write-Host "  │                                                            │" -ForegroundColor DarkGray
Write-Host "  │  3. Edite backend\.env e preencha DATABASE_URL:           │" -ForegroundColor White
Write-Host "  │     mysql://USER:SENHA@HOST:3306/BANCO                    │" -ForegroundColor White
Write-Host "  └───────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Após configurar o banco, rode:" -ForegroundColor Cyan
Write-Host "  .\migrar.ps1   — para criar as tabelas no MySQL HostGator" -ForegroundColor White
Write-Host "  .\dev.ps1      — para iniciar o sistema" -ForegroundColor White
Write-Host ""
Write-Host "  Migrando do Supabase? Veja: MIGRACAO_HOSTGATOR.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ✓ Setup concluído!" -ForegroundColor Green
Write-Host ""

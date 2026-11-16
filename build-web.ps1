# ══════════════════════════════════════════════════════════════════
#  JuriX — empacota a versão WEB para a HostGator
#  Publicação: https://nossosflows.com.br/jurix
#
#  Uso:  .\build-web.ps1
#
#  Gera a pasta deploy-web\ pronta para subir no cPanel (File Manager
#  ou FTP). NÃO inclui node_modules nem .env: as dependências são
#  instaladas no servidor (precisam do binário Linux do Prisma) e o
#  .env é preenchido lá, uma vez só.
# ══════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'
$raiz   = $PSScriptRoot
$saida  = Join-Path $raiz 'deploy-web'

function Passo($texto) { Write-Host "`n>> $texto" -ForegroundColor Cyan }

Passo 'Limpando a pasta de saída'
if (Test-Path $saida) { Remove-Item $saida -Recurse -Force }
New-Item -ItemType Directory -Path $saida | Out-Null

Passo 'Compilando o frontend com base /jurix/ (modo web)'
Push-Location (Join-Path $raiz 'frontend')
try {
    npm run build:web
    if ($LASTEXITCODE -ne 0) { throw "Falha no build do frontend (código $LASTEXITCODE)." }
} finally { Pop-Location }

$indexPath = Join-Path $raiz 'frontend\dist\index.html'
if (-not (Test-Path $indexPath)) { throw 'O build não gerou frontend\dist\index.html.' }

# Conferência real: se o index não aponta para /jurix/, o site abriria
# em branco no servidor — melhor falhar aqui do que lá.
$index = Get-Content $indexPath -Raw
if ($index -notmatch '/jurix/assets/') {
    throw 'O index.html não aponta para /jurix/assets/. Verifique VITE_BASE_PATH em frontend\.env.web.'
}
Write-Host '   index.html aponta para /jurix/ — ok' -ForegroundColor Green

Passo 'Copiando o frontend compilado'
$destFront = Join-Path $saida 'frontend\dist'
New-Item -ItemType Directory -Path $destFront -Force | Out-Null
Copy-Item (Join-Path $raiz 'frontend\dist\*') $destFront -Recurse -Force

Passo 'Copiando o backend (sem node_modules, sem .env)'
$destBack = Join-Path $saida 'backend'
New-Item -ItemType Directory -Path $destBack -Force | Out-Null
foreach ($item in @('src', 'prisma', 'package.json', 'package-lock.json')) {
    $origem = Join-Path $raiz "backend\$item"
    if (Test-Path $origem) { Copy-Item $origem $destBack -Recurse -Force }
}
Copy-Item (Join-Path $raiz 'backend\.env.production.example') (Join-Path $destBack '.env.example') -Force

Passo 'Copiando scripts de administração'
$destScripts = Join-Path $saida 'scripts'
New-Item -ItemType Directory -Path $destScripts -Force | Out-Null
foreach ($s in @('criar-admin.js', 'ativar-plano.js')) {
    Copy-Item (Join-Path $raiz "scripts\$s") $destScripts -Force
}

Passo 'Copiando o guia de publicação'
Copy-Item (Join-Path $raiz 'DEPLOY-HOSTGATOR.md') $saida -Force

# Arquivo de entrada do Passenger (cPanel → Setup Node.js App).
# Fica na raiz para ser indicado como "Application startup file".
#
# Gravado em ASCII puro e sem BOM de propósito: é o Node que lê este
# arquivo, e um BOM ou acento mal codificado aqui derruba o boot no
# servidor, longe de qualquer janela onde dê para ver o erro.
$entrada = @'
// Entrada do Passenger (cPanel -> Setup Node.js App).
//
// O server.js precisa rodar com o CWD em backend/: o dotenv procura o
// .env no diretorio do processo e o Prisma resolve o schema a partir
// dele.
const path = require('path');

process.chdir(path.join(__dirname, 'backend'));

// O frontend compilado fica em ../frontend/dist em relacao ao backend.
// Resolvido aqui, em caminho absoluto, porque um caminho relativo no
// .env seria lido a partir de backend/ e apontaria para o lugar errado
// -- o site subiria servindo so a API, com a pagina em branco.
// server.js da prioridade as variaveis do processo sobre as do .env.
process.env.FRONTEND_DIST =
  process.env.FRONTEND_DIST || path.join(__dirname, 'frontend', 'dist');

require('./backend/src/server.js');
'@
# Set-Content -Encoding utf8 no PowerShell 5.1 grava COM BOM; WriteAllText
# com UTF8Encoding($false) garante o arquivo limpo.
[System.IO.File]::WriteAllText(
    (Join-Path $saida 'app.js'),
    $entrada,
    (New-Object System.Text.UTF8Encoding $false)
)

$tamanho = [math]::Round((Get-ChildItem $saida -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
Write-Host "`n✓ Pacote pronto em: $saida  ($tamanho MB)" -ForegroundColor Green
Write-Host "  Próximo passo: siga DEPLOY-HOSTGATOR.md" -ForegroundColor Green

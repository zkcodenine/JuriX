# ⚠️ Regras para NÃO quebrar o executável nem o auto-update

Leia antes de mexer em build, ícones, updater ou banco. Cada regra aqui nasceu
de um problema real que já aconteceu neste projeto.

---

## 🔄 Auto-update (electron-updater + GitHub Releases)

1. **Sempre suba a versão** em `package.json` antes de gerar um release. A
   versão deve ser **estritamente crescente** (3.0.20 → 3.0.21). **Nunca
   republique a mesma versão** — o updater compara por versão.
2. **Publique SEMPRE os 3 arquivos** da pasta `dist-electron`:
   - `JuriX-Setup-<versão>.exe`
   - `JuriX-Setup-<versão>.exe.blockmap`
   - `latest.yml`  ← **é este que dispara a atualização. Sem ele, ninguém atualiza.**
3. **Mantenha `autoUpdater.disableDifferentialDownload = true`** em
   `electron/updater.js`. O download diferencial (por blockmap) foi a causa nº 1
   de atualização travada/corrompida ao pular várias versões. Baixar o
   instalador inteiro é maior, mas **sempre funciona**.
4. **Mantenha `verifyUpdateCodeSignature => null`** — o app não é assinado; sem
   isso o updater rejeita o instalador e entra em loop.
5. **Mantenha `autoInstallOnAppQuit = false`** (a instalação é só via
   `quitAndInstall(true, true)`; senão o app não reabre após atualizar).
6. **Nunca mude** `build.publish.owner` / `build.publish.repo` nem o `appId`
   (`com.jurix.app`) — muda a identidade do feed e quebra o update de quem já
   tem instalado.
7. **Publicar:** `npm run publish-release` (usa o `gh` autenticado). Se o `gh`
   não estiver no PATH: `C:\Program Files\GitHub CLI\gh.exe`.

## 🖥️ Executável / instalador

8. **`electron/assets/icon.ico`** deve ser um ICO multi-tamanho válido **com o
   256×256**. Não edite à mão. Para regenerar (ex.: trocar o logo), use
   `node scripts/gerar-icones-transparentes.js` e confira que o Windows carrega:
   `Add-Type -AssemblyName System.Drawing; [System.Drawing.Icon]::new("...icon.ico")`.
9. **Não remova do `package.json` (campo `build`)**:
   - `asarUnpack`: `electron/assets/**` (o toast do Windows lê o logo do disco)
     e `node_modules/sharp/**`.
   - `files`: `electron/**`.
   - `extraResources`: `backend` e `frontend/dist` — **sem eles o app não sobe.**
10. **`server.js` deve subir mesmo com o banco fora do ar** (conecta o banco em
    segundo plano). Não coloque nada bloqueante no boot — o Electron desiste em
    ~3 min e o app não abre.
11. **Mantenha o single-instance lock** em `electron/main.js`
    (`requestSingleInstanceLock`). Sem ele, abrir 2× sobe 2 backends na porta
    3001 → erro "servidor interno parou".
12. **Build sempre pelo `build.ps1`** (instala deps, `prisma generate`, empacota,
    e limpa `dist-electron` das versões antigas).

## 🗄️ Banco de dados (MySQL em nuvem, COMPARTILHADO com "Cards de Saúde")

13. **NUNCA rode `prisma db push`** neste banco. Ele gera `DROP TABLE` nas
    tabelas `cards_*` do outro app. **Toda mudança de schema é ADITIVA**, via
    arquivo em `backend/prisma/manual-migrations/*.sql` aplicado com
    `npx prisma db execute --file ...` + `npx prisma generate`.
14. **`migrar.ps1` tem fallback para `db push`** — **não use** para migração
    nova; use `aplicar-migracao.ps1` / `prisma db execute`.

## 🧹 Se o ícone/atalho aparecer genérico (quebrado) numa máquina

Não é o `.ico` (ele é validado). É **cache de ícone do Windows** por reinstalar
muitas versões no mesmo lugar. Solução na máquina afetada:
1. Desinstalar o JuriX e instalar de novo o `JuriX-Setup-<versão>.exe` (limpo).
2. Se persistir, limpar o cache de ícones (PowerShell):
   ```
   ie4uinit.exe -show
   ```
   ou apagar `%LOCALAPPDATA%\IconCache.db` e reiniciar o Explorer.

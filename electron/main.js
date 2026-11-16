'use strict'

const { app, BrowserWindow, dialog, shell, ipcMain, Tray, Menu, Notification, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const log = require('electron-log')

// Identidade da app no Windows — necessária para o toast nativo mostrar o nome
// e o ícone "JuriX" (e não "electron.app..."). Deve casar com o appId do build.
app.setAppUserModelId('com.jurix.app')

// Instância única: se o app já está aberto (inclusive escondido na bandeja),
// uma segunda execução só traz a janela existente para a frente — evita dois
// backends na mesma porta.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => mostrarJanela())
}

// ── Logging ───────────────────────────────────────────────────────────────────
log.initialize()
log.transports.file.level = 'info'
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', 'jurix.log')

// isDev = true apenas quando --dev é passado explicitamente
// (modo dev: Vite + nodemon rodando separados)
const isDev = process.argv.includes('--dev')

const BACKEND_PORT = 3001

let mainWindow = null
let loadingWindow = null
let backendProcess = null
let tray = null
let ultimasNaoLidas = 0
let avisouBandeja = false

// ── Bandeja (system tray) ─────────────────────────────────────────────────────
function assetPath(file) {
  return path.join(__dirname, 'assets', file)
}

// Caminho REAL em disco (fora do app.asar). O toast do Windows é desenhado pelo
// SO, que não lê de dentro do asar — a imagem do logo precisa vir daqui. Em dev
// (sem asar) o replace é inofensivo. Exige `electron/assets/**` em asarUnpack.
function assetPathOnDisk(file) {
  return assetPath(file).replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)
}

function mostrarJanela() {
  if (!mainWindow) { createMainWindow(); return }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  mainWindow.flashFrame(false)
}

function textoBandeja() {
  return ultimasNaoLidas > 0
    ? `JuriX — ${ultimasNaoLidas} não lida${ultimasNaoLidas > 1 ? 's' : ''}`
    : 'JuriX — em dia'
}

function atualizarBandeja() {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    { label: textoBandeja(), enabled: false },
    { type: 'separator' },
    { label: 'Abrir JuriX', click: () => mostrarJanela() },
    { label: 'Sair', click: () => { app.isQuitting = true; app.quit() } },
  ])
  tray.setToolTip(textoBandeja())
  tray.setContextMenu(menu)
}

function criarBandeja() {
  if (tray) return
  try {
    tray = new Tray(assetPath('icon.ico'))
    tray.on('click', () => mostrarJanela())
    tray.on('double-click', () => mostrarJanela())
    atualizarBandeja()
  } catch (err) {
    log.warn('[Tray] não foi possível criar a bandeja:', err.message)
  }
}

// Escapa texto para uso seguro dentro do XML do toast.
function escaparXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// ── Path helpers ──────────────────────────────────────────────────────────────
// Usa process.resourcesPath apenas quando o app está empacotado (isPackaged).
// Em modo "electron ." não-empacotado, usa a raiz do projeto normalmente.
function resourcePath(...parts) {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '..')
  return path.join(base, ...parts)
}

// ── Kill any process already using a port (Windows + Unix) ───────────────────
async function killPortIfBusy(port) {
  const { execSync } = require('child_process')
  try {
    if (process.platform === 'win32') {
      // netstat -ano | findstr :<port>  → extrai PIDs → kill
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', windowsHide: true })
      const pids = new Set()
      for (const line of out.split('\n')) {
        const m = line.trim().match(/\s+(\d+)$/)
        if (m) pids.add(m[1])
      }
      for (const pid of pids) {
        if (pid === '0') continue
        try {
          execSync(`taskkill /F /PID ${pid}`, { windowsHide: true })
          log.info(`[Main] Killed stale process PID ${pid} on port ${port}`)
        } catch (_) {}
      }
    } else {
      execSync(`fuser -k ${port}/tcp 2>/dev/null || true`)
      log.info(`[Main] Freed port ${port} (fuser)`)
    }
    // Wait a moment for the port to be released
    await new Promise(r => setTimeout(r, 600))
  } catch (_) {
    // Port was already free — no action needed
  }
}

// ── Start backend ─────────────────────────────────────────────────────────────
async function startBackend() {
  // Modo dev: backend já roda via nodemon separado
  if (isDev) {
    log.info('[Main] Dev mode — backend externo esperado na porta', BACKEND_PORT)
    return
  }

  // Libera a porta caso processo anterior não tenha sido encerrado
  await killPortIfBusy(BACKEND_PORT)

  return new Promise((resolve, reject) => {
    const serverScript = resourcePath('backend', 'src', 'server.js')
    const envFile = resourcePath('backend', '.env')
    const frontendDist = resourcePath('frontend', 'dist')
    const storageDir = path.join(app.getPath('userData'), 'storage')
    const logsDir = path.join(app.getPath('userData'), 'logs')

    log.info('[Main] Iniciando backend:', serverScript)

    const { utilityProcess } = require('electron')

    backendProcess = utilityProcess.fork(serverScript, [], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(BACKEND_PORT),
        ELECTRON: 'true',
        SERVE_FRONTEND: 'true',
        DOTENV_CONFIG_PATH: envFile,
        FRONTEND_DIST: frontendDist,
        STORAGE_PATH: storageDir,
        LOG_PATH: logsDir,
        // No app empacotado, aponta o Prisma para o engine binário correto
        ...(app.isPackaged ? {
          PRISMA_QUERY_ENGINE_LIBRARY: path.join(
            process.resourcesPath, 'backend',
            'node_modules', '.prisma', 'client',
            'query_engine-windows.dll.node'
          ),
        } : {}),
      },
      stdio: 'pipe',
    })

    progresso(18, 'Iniciando o servidor interno')

    backendProcess.stdout?.on('data', (d) => log.info('[Backend]', d.toString().trim()))
    backendProcess.stderr?.on('data', (d) => log.warn('[Backend]', d.toString().trim()))

    backendProcess.on('exit', (code) => {
      // Se estamos saindo (quit normal ou update) — ignora silenciosamente
      if (app.isQuitting || global.__jurixUpdating) {
        log.info('[Main] Backend encerrado durante shutdown/update (esperado)')
        return
      }
      log.error('[Main] Backend encerrou com código', code)
      dialog.showErrorBox(
        'Erro — JuriX',
        `O servidor interno parou (código ${code}).\n\nVerifique sua conexão com a internet e abra o aplicativo novamente.`
      )
      app.exit(1)
    })

    // Aguarda /health responder.
    //
    // O limite era 45s e estourava justamente no boot seguinte a um update:
    // com os ~700MB recém-gravados, o antivírus varre cada arquivo no primeiro
    // acesso e o backend leva 30-43s para carregar (medido nesta máquina),
    // contra ~6s quando os arquivos já estão em cache. Como todo auto-update é
    // seguido de um boot frio, 45s vivia no limite — daí o erro intermitente.
    // 3 min dá folga real; quem falha de verdade falha rápido (o processo morre
    // e o handler de 'exit' acima reporta).
    const MAX_TENTATIVAS = 180
    let attempts = 0

    const poll = () => {
      http
        .get(`http://localhost:${BACKEND_PORT}/health`, (res) => {
          if (res.statusCode === 200) {
            log.info(`[Main] Backend pronto! (${attempts + 2}s)`)
            progresso(82, 'Servidor pronto')
            resolve()
          } else {
            retry()
          }
        })
        .on('error', retry)
    }

    const retry = () => {
      if (++attempts > MAX_TENTATIVAS) {
        reject(new Error(`Backend não respondeu após ${MAX_TENTATIVAS} segundos.\nVerifique sua conexão e o arquivo .env.`))
        return
      }
      // Alimenta a barra enquanto esperamos: 18% → 78% ao longo do tempo
      // esperado de boot (mais longo na primeira abertura). É só uma estimativa
      // — o marco real de 82% chega quando o /health responde.
      const esperadoSegundos = global.__jurixPrimeiraAbertura ? 45 : 10
      progresso(18 + Math.min(1, attempts / esperadoSegundos) * 60)

      // Loga de tempos em tempos para o log mostrar que ainda está esperando.
      if (attempts % 15 === 0) log.info(`[Main] Aguardando backend... ${attempts}s`)
      setTimeout(poll, 1000)
    }

    setTimeout(poll, 2000)
  })
}

// ── Primeira abertura ─────────────────────────────────────────────────────────
// O aviso "pode levar até 1 minuto" só faz sentido na PRIMEIRA abertura depois
// de instalar ou atualizar — é quando o antivírus varre os arquivos novos e o
// backend leva 30-45s em vez de ~6s. Nas aberturas seguintes o texto só
// assustaria sem motivo.
//
// A marca fica num JSON no userData (sobrevive a updates; é apagada só na
// desinstalação com limpeza de dados). Guardamos a versão para que cada
// atualização volte a contar como "primeira abertura" daquela versão.
const ARQUIVO_ESTADO = () => path.join(app.getPath('userData'), 'estado-abertura.json')

function ehPrimeiraAbertura() {
  try {
    const bruto = fs.readFileSync(ARQUIVO_ESTADO(), 'utf8')
    const estado = JSON.parse(bruto)
    return estado?.ultimaVersaoAberta !== app.getVersion()
  } catch (_) {
    // Arquivo inexistente ou corrompido → trata como primeira abertura.
    return true
  }
}

function marcarAberturaConcluida() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(
      ARQUIVO_ESTADO(),
      JSON.stringify({ ultimaVersaoAberta: app.getVersion(), em: new Date().toISOString() }, null, 2),
      'utf8'
    )
  } catch (err) {
    log.warn('[Main] Não foi possível gravar estado-abertura.json:', err.message)
  }
}

// ── Loading window ────────────────────────────────────────────────────────────
function createLoadingWindow(primeiraAbertura) {
  loadingWindow = new BrowserWindow({
    width: 640,
    height: 480,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: '#0a0a0a',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  loadingWindow.loadFile(path.join(__dirname, 'loading.html'), {
    query: { primeira: primeiraAbertura ? '1' : '0' },
  })
  loadingWindow.show()
}

// Empurra um marco real de progresso para a barra da tela de carregamento.
// Best-effort: se a janela já fechou (ou ainda não carregou), ignora.
function progresso(pct, texto) {
  try {
    if (!loadingWindow || loadingWindow.isDestroyed()) return
    const js = `window.jurixProgresso && window.jurixProgresso(${Number(pct)}, ${JSON.stringify(texto || '')})`
    loadingWindow.webContents.executeJavaScript(js).catch(() => {})
  } catch (_) { /* best-effort */ }
}

// ── Main window ───────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'JuriX',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#0a0a0a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      // Mantém timers e áudio vivos quando a janela está escondida na bandeja —
      // é o que permite o polling de notificações e o som suave continuarem
      // funcionando em segundo plano.
      backgroundThrottling: false,
    },
  })

  // Dev: tenta Vite (3000) primeiro; se não responder, cai pro backend (3001)
  // Prod: backend serve o frontend (3001)
  let appUrl = isDev
    ? 'http://localhost:3000'
    : `http://localhost:${BACKEND_PORT}`

  mainWindow.loadURL(appUrl)

  // Retry automático se o frontend ainda não carregou
  mainWindow.webContents.on('did-fail-load', (_e, errCode) => {
    if (errCode === -3) return // Navegação cancelada — ignora
    // Em dev, se o Vite (3000) não está rodando, usa o backend (3001)
    if (isDev && appUrl.includes(':3000')) {
      log.info('[Main] Vite não encontrado — usando backend em', BACKEND_PORT)
      appUrl = `http://localhost:${BACKEND_PORT}`
    }
    setTimeout(() => mainWindow?.loadURL(appUrl), 1500)
  })

  mainWindow.once('ready-to-show', () => {
    // Barra em 100% antes de fechar — o usuário vê a conclusão, não um corte.
    progresso(100, 'Tudo pronto')
    marcarAberturaConcluida()
    setTimeout(() => {
      loadingWindow?.close()
      loadingWindow = null
      mainWindow.show()
      mainWindow.maximize()
    }, 350)
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // Fechar (X) NÃO encerra o app — esconde na bandeja e segue em segundo plano,
  // recebendo/monitorando notificações. Só sai de verdade pelo menu "Sair" da
  // bandeja (ou durante uma atualização).
  mainWindow.on('close', (e) => {
    if (app.isQuitting || global.__jurixUpdating) return
    e.preventDefault()
    mainWindow.hide()
    if (!avisouBandeja) {
      avisouBandeja = true
      try {
        tray?.displayBalloon?.({
          icon: assetPath('icon.ico'),
          title: 'JuriX continua rodando',
          content: 'O sistema segue em segundo plano na bandeja, avisando quando houver novidades. Clique no ícone para reabrir.',
        })
      } catch (_) {}
    }
  })

  // Ao focar a janela, para de piscar na barra de tarefas.
  mainWindow.on('focus', () => mainWindow.flashFrame(false))

  // Sem barra de menu em produção
  if (!isDev) mainWindow.setMenuBarVisibility(false)

  // Links externos → browser padrão
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    if (u.startsWith('http')) shell.openExternal(u)
    return { action: 'deny' }
  })

  return mainWindow
}

// ── Shutdown limpo para atualização ────────────────────────────────────────
// Usado pelo updater.js antes de chamar quitAndInstall. Evita o handler
// "backend exit" disparar showErrorBox + app.exit(1), que cancelava o installer.
global.__jurixUpdating = false
global.__jurixShutdownForUpdate = async function () {
  log.info('[Main] Shutdown para atualização — matando backend e janelas')
  global.__jurixUpdating = true
  app.isQuitting = true

  // Mata backend antes do quitAndInstall para garantir que a porta 3001 libere
  if (backendProcess) {
    try { backendProcess.kill() } catch (_) {}
    backendProcess = null
  }
  try {
    const { execSync } = require('child_process')
    if (process.platform === 'win32') {
      execSync(
        `FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :${BACKEND_PORT}') DO taskkill /F /PID %P`,
        { windowsHide: true, shell: true }
      )
    }
  } catch (_) {}

  // Fecha as janelas
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.removeAllListeners('close'); w.destroy() } catch (_) {}
  }

  // Pequena espera para garantir que o backend saiu
  await new Promise((r) => setTimeout(r, 400))
}

// ── IPC: instalar atualização ─────────────────────────────────────────────────
ipcMain.on('updater-action', (_e, action) => {
  if (action === 'install') {
    global.__jurixShutdownForUpdate().then(() =>
      require('electron-updater').autoUpdater.quitAndInstall(true, true)
    )
  }
})

// ── IPC: notificação nativa do Windows (toast temático) ───────────────────────
// O renderer chama isto quando detecta uma notificação nova. Se a janela já
// está em foco, não incomoda com toast (o badge interno já mostra). Caso
// contrário: toast com o logo circular do JuriX + pisca a barra de tarefas.
ipcMain.on('jurix-notify', (_e, payload) => {
  try {
    if (!Notification.isSupported()) return
    if (mainWindow && mainWindow.isFocused()) return

    const { titulo, corpo, processoId } = payload || {}
    let options

    if (process.platform === 'win32') {
      // Toast adaptativo do Windows: logo do app recortado em círculo, título,
      // corpo e a assinatura "JuriX". Áudio silenciado — o som suave é tocado
      // pelo próprio app (Web Audio), para termos controle total do timbre.
      const logo = assetPathOnDisk('icon.png').replace(/\\/g, '/')
      const toastXml = [
        '<toast activationType="foreground" scenario="default">',
        '  <visual>',
        '    <binding template="ToastGeneric">',
        `      <image placement="appLogoOverride" hint-crop="circle" src="file:///${logo}"/>`,
        `      <text>${escaparXml(titulo || 'JuriX')}</text>`,
        `      <text>${escaparXml(corpo || '')}</text>`,
        '      <text placement="attribution">JuriX</text>',
        '    </binding>',
        '  </visual>',
        '  <audio silent="true"/>',
        '</toast>',
      ].join('\n')
      options = { toastXml }
    } else {
      options = { title: titulo || 'JuriX', body: corpo || '', icon: assetPath('icon.png'), silent: true }
    }

    const n = new Notification(options)
    n.on('click', () => {
      mostrarJanela()
      if (processoId) mainWindow?.webContents.send('jurix-abrir-processo', processoId)
    })
    n.show()

    // Pisca a barra de tarefas se a janela não está visível/focada.
    if (mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true)
  } catch (err) {
    log.warn('[Notify] falha ao exibir toast:', err.message)
  }
})

// ── IPC: badge de não lidas (barra de tarefas + bandeja) ──────────────────────
ipcMain.on('jurix-badge', (_e, n) => {
  ultimasNaoLidas = Number(n) || 0
  atualizarBandeja()
  if (!mainWindow) return
  try {
    if (ultimasNaoLidas > 0) {
      const badge = nativeImage.createFromPath(assetPath('badge.png'))
      mainWindow.setOverlayIcon(badge, `${ultimasNaoLidas} não lida(s)`)
    } else {
      mainWindow.setOverlayIcon(null, '')
    }
  } catch (_) { /* overlay indisponível — ignora */ }
})

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Segunda instância: já pedimos app.quit() acima, mas o whenReady ainda pode
  // disparar. Sem este guard, a 2ª instância subiria OUTRO backend na porta
  // 3001 — que é exatamente o que causava o "servidor interno parou (código 0)"
  // quando o app abria duas vezes. Aborta aqui e deixa a 1ª instância no ar.
  if (!gotTheLock) return

  // Calculado uma única vez, ANTES de marcar a abertura como concluída.
  global.__jurixPrimeiraAbertura = ehPrimeiraAbertura()
  log.info('[Main] Primeira abertura desta versão:', global.__jurixPrimeiraAbertura)

  createLoadingWindow(global.__jurixPrimeiraAbertura)

  try {
    await startBackend()
    progresso(90, 'Abrindo o JuriX')
    const win = createMainWindow()
    criarBandeja()

    if (!isDev) {
      const { setupAutoUpdater } = require('./updater')
      setupAutoUpdater(win)
    }
  } catch (err) {
    log.error('[Main] Falha na inicialização:', err)
    dialog.showErrorBox(
      'Falha ao Iniciar — JuriX',
      `Não foi possível iniciar o servidor JuriX:\n\n${err.message}`
    )
    app.quit()
  }
})

app.on('window-all-closed', () => {
  // Durante uma atualização, o updater destrói as janelas de propósito para
  // liberar a porta do backend. NÃO chamar app.quit() aqui — senão o
  // autoInstallOnAppQuit dispara a instalação com isForceRunAfter=false e o
  // app não reabre. Deixa o quitAndInstall(true, true) do updater cuidar disso.
  if (global.__jurixUpdating) return
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (backendProcess) {
    try { backendProcess.kill() } catch (_) {}
    backendProcess = null
  }
  // Garante limpeza da porta ao sair (fallback para quando kill não funciona)
  try {
    const { execSync } = require('child_process')
    if (process.platform === 'win32') {
      execSync(`FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :${BACKEND_PORT}') DO taskkill /F /PID %P`, { windowsHide: true, shell: true })
    }
  } catch (_) {}
})

app.on('activate', () => {
  if (!mainWindow) createMainWindow()
})

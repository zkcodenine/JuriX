'use strict'

const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron')
const path = require('path')
const http = require('http')
const log = require('electron-log')

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

// ── Path helpers ──────────────────────────────────────────────────────────────
// Usa process.resourcesPath apenas quando o app está empacotado (isPackaged).
// Em modo "electron ." não-empacotado, usa a raiz do projeto normalmente.
function resourcePath(...parts) {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '..')
  return path.join(base, ...parts)
}

// ── Start backend ─────────────────────────────────────────────────────────────
async function startBackend() {
  // Modo dev: backend já roda via nodemon separado
  if (isDev) {
    log.info('[Main] Dev mode — backend externo esperado na porta', BACKEND_PORT)
    return
  }

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

    backendProcess.stdout?.on('data', (d) => log.info('[Backend]', d.toString().trim()))
    backendProcess.stderr?.on('data', (d) => log.warn('[Backend]', d.toString().trim()))

    backendProcess.on('exit', (code) => {
      if (!app.isQuitting) {
        log.error('[Main] Backend encerrou com código', code)
        dialog.showErrorBox(
          'Erro — JuriX',
          `O servidor interno parou (código ${code}).\n\nVerifique sua conexão com a internet e abra o aplicativo novamente.`
        )
        app.exit(1)
      }
    })

    // Aguarda /health responder (máx 45 s)
    let attempts = 0

    const poll = () => {
      http
        .get(`http://localhost:${BACKEND_PORT}/health`, (res) => {
          if (res.statusCode === 200) {
            log.info('[Main] Backend pronto!')
            resolve()
          } else {
            retry()
          }
        })
        .on('error', retry)
    }

    const retry = () => {
      if (++attempts > 45) {
        reject(new Error('Backend não respondeu após 45 segundos.\nVerifique sua conexão e o arquivo .env.'))
        return
      }
      setTimeout(poll, 1000)
    }

    setTimeout(poll, 2000)
  })
}

// ── Loading window ────────────────────────────────────────────────────────────
function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 480,
    height: 300,
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
  loadingWindow.loadFile(path.join(__dirname, 'loading.html'))
  loadingWindow.show()
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
    loadingWindow?.close()
    loadingWindow = null
    mainWindow.show()
    mainWindow.maximize()
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // Sem barra de menu em produção
  if (!isDev) mainWindow.setMenuBarVisibility(false)

  // Links externos → browser padrão
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    if (u.startsWith('http')) shell.openExternal(u)
    return { action: 'deny' }
  })

  return mainWindow
}

// ── IPC: instalar atualização ─────────────────────────────────────────────────
ipcMain.on('updater-action', (_e, action) => {
  if (action === 'install') {
    require('electron-updater').autoUpdater.quitAndInstall(false, true)
  }
})

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createLoadingWindow()

  try {
    await startBackend()
    const win = createMainWindow()

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
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  app.isQuitting = true
  backendProcess?.kill()
})

app.on('activate', () => {
  if (!mainWindow) createMainWindow()
})

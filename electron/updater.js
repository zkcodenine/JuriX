'use strict'

const { autoUpdater } = require('electron-updater')
const { dialog, app } = require('electron')
const path = require('path')
const log = require('electron-log')

autoUpdater.logger = log
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowDowngrade = false
// Garante que o instalador rode em modo silencioso
autoUpdater.disableWebInstaller = true

// ── Config ───────────────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 30 * 60 * 1000   // 30 min
const RETRY_DELAYS = [10000, 30000, 60000, 120000, 300000]
const INITIAL_DELAY = 5000

function setupAutoUpdater(mainWindow) {
  let updateVersion = null
  let retryCount = 0
  let checkTimer = null
  let retryTimer = null

  // ── Guards — impedem ciclos infinitos ─────────────────────────────────────
  let isChecking = false
  let isDownloading = false
  let hasPromptedInstall = false
  let isQuittingToInstall = false
  let lastDownloadedVersion = null

  function send(event, data = {}) {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('update-status', { event, ...data })
      }
    } catch (err) {
      log.warn('[Updater] Failed to send to renderer:', err.message)
    }
  }

  // ── Verificação com guard ────────────────────────────────────────────────
  function checkNow() {
    if (isChecking || isDownloading || isQuittingToInstall || hasPromptedInstall) {
      log.info('[Updater] Skip check — busy state',
        { isChecking, isDownloading, isQuittingToInstall, hasPromptedInstall })
      return
    }
    isChecking = true
    log.info('[Updater] Checking for updates...')
    autoUpdater.checkForUpdates()
      .catch((err) => {
        log.warn('[Updater] Check failed:', err.message)
        scheduleRetry()
      })
      .finally(() => { isChecking = false })
  }

  function scheduleRetry() {
    if (retryCount >= RETRY_DELAYS.length) {
      log.info('[Updater] Max retries reached.')
      retryCount = 0
      return
    }
    const delay = RETRY_DELAYS[retryCount]
    log.info(`[Updater] Retry in ${delay / 1000}s (${retryCount + 1}/${RETRY_DELAYS.length})`)
    retryCount++
    clearTimeout(retryTimer)
    retryTimer = setTimeout(checkNow, delay)
  }

  // ── Update disponível ─────────────────────────────────────────────────────
  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Update available:', info.version)
    updateVersion = info.version
    isDownloading = true // bloqueia checks concorrentes enquanto baixa
    retryCount = 0
    send('available', { version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[Updater] Up to date.')
    retryCount = 0
    send('up-to-date')
  })

  // ── Progresso do download ────────────────────────────────────────────────
  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent)
    send('progress', {
      percent: pct,
      version: updateVersion,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  // ── Download concluído: instala silenciosamente ──────────────────────────
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Update downloaded:', info.version)
    isDownloading = false

    // Evita disparar 2x para a mesma versão
    if (hasPromptedInstall && lastDownloadedVersion === info.version) {
      log.info('[Updater] Install already prompted for this version, skipping.')
      return
    }
    hasPromptedInstall = true
    lastDownloadedVersion = info.version

    // Encerra timers — não queremos outra verificação concorrente
    clearInterval(checkTimer)
    clearTimeout(retryTimer)

    send('downloaded', { version: info.version })

    let iconPath
    try {
      iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'electron', 'assets', 'icon.ico')
        : path.join(__dirname, 'assets', 'icon.ico')
    } catch {
      iconPath = undefined
    }

    const dialogOpts = {
      type: 'info',
      title: 'Atualização Obrigatória — JuriX',
      message: `Versão ${info.version} pronta para instalar.`,
      detail:
        'Uma nova versão do JuriX foi baixada. O aplicativo será fechado e atualizado automaticamente.\n\n' +
        'Clique em "Atualizar Agora" para continuar.',
      buttons: ['Atualizar Agora'],
      defaultId: 0,
      noLink: true,
    }
    if (iconPath) dialogOpts.icon = iconPath

    const parentWin = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null

    const doInstall = async () => {
      if (isQuittingToInstall) return
      isQuittingToInstall = true
      log.info('[Updater] Shutdown limpo + quitAndInstall silencioso...')
      try {
        // Sinaliza shutdown para o handler "backend exit" não cancelar a instalação
        if (typeof global.__jurixShutdownForUpdate === 'function') {
          await global.__jurixShutdownForUpdate()
        }
      } catch (err) {
        log.warn('[Updater] Shutdown helper failed:', err.message)
      }
      setImmediate(() => {
        try {
          // isSilent=true (NSIS oneClick), isForceRunAfter=true (reabre após instalar)
          autoUpdater.quitAndInstall(true, true)
        } catch (err) {
          log.error('[Updater] quitAndInstall failed:', err.message)
          isQuittingToInstall = false
        }
      })
    }

    dialog.showMessageBox(parentWin, dialogOpts).then(doInstall).catch((err) => {
      log.error('[Updater] Dialog error, installing anyway:', err.message)
      doInstall()
    })
  })

  // ── Erro: loga e agenda retry (não faz loop agressivo) ───────────────────
  autoUpdater.on('error', (err) => {
    log.warn('[Updater] Error:', err.message)
    isDownloading = false
    send('error', { message: err.message })
    scheduleRetry()
  })

  // ── Checagem inicial + periódica ─────────────────────────────────────────
  setTimeout(checkNow, INITIAL_DELAY)
  checkTimer = setInterval(() => {
    retryCount = 0
    checkNow()
  }, CHECK_INTERVAL_MS)

  log.info('[Updater] Initialized — first check in 5s, periodic every 30min')
}

module.exports = { setupAutoUpdater }

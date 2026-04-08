'use strict'

const { autoUpdater } = require('electron-updater')
const { dialog, app } = require('electron')
const path = require('path')
const log = require('electron-log')

autoUpdater.logger = log
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowDowngrade = false

// ── Retry / interval config ──────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 30 * 60 * 1000   // 30 min — periodic checks
const RETRY_DELAYS = [10000, 30000, 60000, 120000, 300000] // 10s, 30s, 1m, 2m, 5m
const INITIAL_DELAY = 5000                  // first check 5s after launch

function setupAutoUpdater(mainWindow) {
  let updateVersion = null
  let retryCount = 0
  let checkTimer = null
  let retryTimer = null

  // ── Send status to renderer ────────────────────────────────────────────────
  function send(event, data = {}) {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('update-status', { event, ...data })
      }
    } catch (err) {
      log.warn('[Updater] Failed to send to renderer:', err.message)
    }
  }

  // ── Check for updates with retry logic ─────────────────────────────────────
  function checkNow() {
    log.info('[Updater] Checking for updates...')
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn('[Updater] Check failed:', err.message)
      scheduleRetry()
    })
  }

  function scheduleRetry() {
    if (retryCount >= RETRY_DELAYS.length) {
      log.info('[Updater] Max retries reached, will try again on next periodic check.')
      retryCount = 0
      return
    }
    const delay = RETRY_DELAYS[retryCount]
    log.info(`[Updater] Retrying in ${delay / 1000}s (attempt ${retryCount + 1}/${RETRY_DELAYS.length})`)
    retryCount++
    clearTimeout(retryTimer)
    retryTimer = setTimeout(checkNow, delay)
  }

  // ── Update available ───────────────────────────────────────────────────────
  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Update available:', info.version)
    updateVersion = info.version
    retryCount = 0 // reset retries on success
    send('available', { version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[Updater] App is up to date.')
    retryCount = 0
    send('up-to-date')
  })

  // ── Download progress ──────────────────────────────────────────────────────
  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent)
    log.info(`[Updater] Downloading: ${pct}%`)
    send('progress', {
      percent: pct,
      version: updateVersion,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  // ── Downloaded: FORCE install — user cannot skip ───────────────────────────
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Update downloaded:', info.version)
    send('downloaded', { version: info.version })

    // Resolve icon path — works both in asar and unpacked
    let iconPath
    try {
      iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'electron', 'assets', 'icon.ico')
        : path.join(__dirname, 'assets', 'icon.ico')
    } catch {
      iconPath = undefined
    }

    // Mandatory dialog — no cancel
    const dialogOpts = {
      type: 'info',
      title: 'Atualização Obrigatória — JuriX',
      message: `Versão ${info.version} baixada com sucesso.`,
      detail:
        'Uma nova versão do JuriX foi instalada e precisa ser ativada.\n\n' +
        'O aplicativo será reiniciado agora.',
      buttons: ['Reiniciar e Atualizar'],
      defaultId: 0,
      noLink: true,
    }
    if (iconPath) dialogOpts.icon = iconPath

    const parentWin = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null

    dialog
      .showMessageBox(parentWin, dialogOpts)
      .then(() => {
        log.info('[Updater] User confirmed — quitting and installing...')
        setImmediate(() => autoUpdater.quitAndInstall(false, true))
      })
      .catch((err) => {
        log.error('[Updater] Dialog error, force-installing anyway:', err.message)
        setImmediate(() => autoUpdater.quitAndInstall(false, true))
      })
  })

  // ── Error handling with auto-retry ─────────────────────────────────────────
  autoUpdater.on('error', (err) => {
    log.warn('[Updater] Error (non-fatal):', err.message)
    send('error', { message: err.message })
    // Retry on network/download errors
    scheduleRetry()
  })

  // ── Initial check ─────────────────────────────────────────────────────────
  setTimeout(checkNow, INITIAL_DELAY)

  // ── Periodic re-check ─────────────────────────────────────────────────────
  checkTimer = setInterval(() => {
    retryCount = 0 // reset retries for each periodic cycle
    checkNow()
  }, CHECK_INTERVAL_MS)

  log.info('[Updater] Initialized — first check in 5s, periodic every 30min')
}

module.exports = { setupAutoUpdater }

'use strict'

const { autoUpdater } = require('electron-updater')
const { dialog, BrowserWindow } = require('electron')
const log = require('electron-log')

autoUpdater.logger = log
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

// Relay status to renderer window
function send(win, event, data = {}) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-status', { event, ...data })
  }
}

function setupAutoUpdater(mainWindow) {
  // ── Update available: start download automatically ─────────────────────────
  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Update available:', info.version)
    send(mainWindow, 'available', { version: info.version })

    // Show non-dismissable notice via loading overlay in renderer
    // (the renderer listens via window.jurixUpdater.onStatus)
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[Updater] App is up to date.')
    send(mainWindow, 'up-to-date')
  })

  // ── Download progress ──────────────────────────────────────────────────────
  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent)
    log.info(`[Updater] Downloading: ${pct}%`)
    send(mainWindow, 'progress', {
      percent: pct,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  // ── Downloaded: FORCE install — user cannot skip ───────────────────────────
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Update downloaded:', info.version)
    send(mainWindow, 'downloaded', { version: info.version })

    // Show mandatory dialog — no "Cancel" button
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualização Obrigatória — JuriX',
        message: `Versão ${info.version} baixada com sucesso.`,
        detail:
          'Uma nova versão do JuriX foi instalada e precisa ser ativada.\n\n' +
          'O aplicativo será reiniciado agora.',
        buttons: ['Reiniciar e Atualizar'],
        defaultId: 0,
        noLink: true,
        icon: require('path').join(__dirname, 'assets', 'icon.ico'),
      })
      .then(() => {
        autoUpdater.quitAndInstall(false, true)
      })
  })

  autoUpdater.on('error', (err) => {
    log.warn('[Updater] Error (non-fatal):', err.message)
    send(mainWindow, 'error', { message: err.message })
    // Do NOT crash the app for update errors
  })

  // ── Check for updates ~5s after app is ready ──────────────────────────────
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn('[Updater] Check failed:', err.message)
    })
  }, 5000)
}

module.exports = { setupAutoUpdater }

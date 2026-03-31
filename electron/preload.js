'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Expose safe bridge for auto-updater UI
contextBridge.exposeInMainWorld('jurixUpdater', {
  onStatus: (cb) => ipcRenderer.on('update-status', (_e, data) => cb(data)),
  install: () => ipcRenderer.send('updater-action', 'install'),
})

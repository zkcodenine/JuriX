'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Expose safe bridge for auto-updater UI
contextBridge.exposeInMainWorld('jurixUpdater', {
  onStatus: (cb) => ipcRenderer.on('update-status', (_e, data) => cb(data)),
  install: () => ipcRenderer.send('updater-action', 'install'),
})

// ── Ponte de notificações/bandeja para o renderer ─────────────────────────────
// O renderer (React) detecta novas notificações e pede ao processo principal
// para exibir o toast nativo do Windows, atualizar o badge da bandeja e reagir
// ao clique. `isElectron` deixa o front saber que roda dentro do app.
contextBridge.exposeInMainWorld('jurixDesktop', {
  isElectron: true,
  // Dispara um toast nativo: { titulo, corpo, processoId, tipo }
  notify: (payload) => ipcRenderer.send('jurix-notify', payload),
  // Atualiza o número de não lidas (badge na barra de tarefas + tooltip da bandeja)
  setBadge: (n) => ipcRenderer.send('jurix-badge', n),
  // Callback quando o usuário clica numa notificação de processo
  onAbrirProcesso: (cb) => ipcRenderer.on('jurix-abrir-processo', (_e, processoId) => cb(processoId)),
})

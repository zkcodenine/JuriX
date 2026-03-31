import { create } from 'zustand';

/* ══════════════════════════════════════════════════════════════
   Connection Status Store
   Tracks online/offline state, manages reconnection detection,
   and coordinates data refresh when connection is restored.
══════════════════════════════════════════════════════════════ */

const useConnectionStore = create((set, get) => ({
  // Connection state
  isOnline: navigator.onLine,
  wasOffline: false,        // true if we were offline and just came back
  showReconnected: false,   // show "back online" banner
  lastOnlineAt: navigator.onLine ? Date.now() : null,
  isUsingCache: false,      // whether current data comes from SW cache
  connectionQuality: 'good', // 'good' | 'slow' | 'offline'

  // Pending sync flag
  needsSync: false,

  // Set connection state
  setOnline: () => {
    const state = get();
    const wasOffline = !state.isOnline;
    set({
      isOnline: true,
      wasOffline,
      showReconnected: wasOffline,
      lastOnlineAt: Date.now(),
      connectionQuality: 'good',
      needsSync: wasOffline ? true : state.needsSync,
    });
    // Auto-hide reconnected banner after 5s
    if (wasOffline) {
      setTimeout(() => set({ showReconnected: false }), 5000);
    }
  },

  setOffline: () => {
    set({
      isOnline: false,
      connectionQuality: 'offline',
      isUsingCache: true,
    });
  },

  setConnectionQuality: (quality) => set({ connectionQuality: quality }),
  setIsUsingCache: (val) => set({ isUsingCache: val }),
  setSynced: () => set({ needsSync: false, isUsingCache: false }),
  dismissReconnected: () => set({ showReconnected: false }),
}));

// ─── Initialize browser event listeners ────────────────────
function initConnectionListeners() {
  const store = useConnectionStore.getState;

  window.addEventListener('online', () => {
    useConnectionStore.getState().setOnline();
  });

  window.addEventListener('offline', () => {
    useConnectionStore.getState().setOffline();
  });

  // Periodic connectivity check (every 30s)
  // Detects cases where browser says online but server is unreachable
  let checkInterval = null;

  function startConnectivityCheck() {
    if (checkInterval) return;
    checkInterval = setInterval(async () => {
      try {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch('/api/auth/health', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        }).catch(() => null);

        clearTimeout(timeout);
        const elapsed = Date.now() - start;

        if (!res || !res.ok) {
          // Server unreachable
          if (navigator.onLine) {
            useConnectionStore.getState().setConnectionQuality('slow');
          } else {
            useConnectionStore.getState().setOffline();
          }
        } else if (elapsed > 5000) {
          useConnectionStore.getState().setConnectionQuality('slow');
          if (!useConnectionStore.getState().isOnline) {
            useConnectionStore.getState().setOnline();
          }
        } else {
          if (!useConnectionStore.getState().isOnline) {
            useConnectionStore.getState().setOnline();
          }
          useConnectionStore.getState().setConnectionQuality('good');
        }
      } catch {
        // Ignore — connection check failed
      }
    }, 30000);
  }

  startConnectivityCheck();

  // Visibility change: check connection when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Immediate check when tab regains focus
      setTimeout(() => {
        fetch('/api/auth/health', { method: 'HEAD', cache: 'no-store' })
          .then((res) => {
            if (res.ok && !useConnectionStore.getState().isOnline) {
              useConnectionStore.getState().setOnline();
            }
          })
          .catch(() => {
            if (navigator.onLine) {
              useConnectionStore.getState().setConnectionQuality('slow');
            }
          });
      }, 1000);
    }
  });
}

export { initConnectionListeners };
export default useConnectionStore;

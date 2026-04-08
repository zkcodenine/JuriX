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

  // Returns adaptive polling interval (ms) based on connection quality
  getPollingInterval: (baseMs) => {
    const quality = get().connectionQuality;
    if (quality === 'offline') return false; // disable polling
    if (quality === 'slow') return baseMs * 3; // 3x slower
    return baseMs;
  },
}));

// ─── Initialize browser event listeners ────────────────────
function initConnectionListeners() {
  window.addEventListener('online', () => {
    useConnectionStore.getState().setOnline();
  });

  window.addEventListener('offline', () => {
    useConnectionStore.getState().setOffline();
  });

  // Periodic connectivity check
  // Adaptive interval: 60s normally, 120s when slow, stops when offline
  let checkTimeout = null;

  function getCheckInterval() {
    const q = useConnectionStore.getState().connectionQuality;
    if (q === 'offline') return 120000; // 2 min when offline (just to detect recovery)
    if (q === 'slow') return 90000;     // 90s when slow (less overhead)
    return 60000;                        // 60s when good (was 30s — too aggressive)
  }

  async function runCheck() {
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s (was 8s — too tight for 4G)

      const res = await fetch('/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      }).catch(() => null);

      clearTimeout(timeout);
      const elapsed = Date.now() - start;

      if (!res || !res.ok) {
        if (navigator.onLine) {
          useConnectionStore.getState().setConnectionQuality('slow');
        } else {
          useConnectionStore.getState().setOffline();
        }
      } else if (elapsed > 10000) {
        // 10s threshold (was 5s — too tight for 4G with 200-500ms latency)
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

    // Schedule next check with adaptive interval
    checkTimeout = setTimeout(runCheck, getCheckInterval());
  }

  // Start first check after 10s (let app load first)
  checkTimeout = setTimeout(runCheck, 10000);

  // Visibility change: check connection when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Immediate check when tab regains focus (with generous timeout)
      setTimeout(() => {
        fetch('/health', { method: 'HEAD', cache: 'no-store' })
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

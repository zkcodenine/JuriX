/* ══════════════════════════════════════════════════════════════
   Offline Cache — IndexedDB wrapper for caching API responses
   Provides fallback data when the network is unavailable.
══════════════════════════════════════════════════════════════ */

const DB_NAME = 'jurix-offline';
const DB_VERSION = 1;
const STORE_NAME = 'api-cache';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Save API response to IndexedDB ──────────────────────
export async function cacheResponse(url, data) {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      url,
      data,
      timestamp: Date.now(),
    });
  } catch {
    // Silently fail — cache is best-effort
  }
}

// ─── Get cached API response ─────────────────────────────
export async function getCachedResponse(url) {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(url);
      req.onsuccess = () => {
        const result = req.result;
        if (result) {
          resolve({ data: result.data, timestamp: result.timestamp, cached: true });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ─── Clear all cached data ───────────────────────────────
export async function clearCache() {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch {
    // Silently fail
  }
}

// ─── Cacheable endpoints (GET only) ─────────────────────
const CACHEABLE_PATHS = [
  '/dashboard',
  '/processos',
  '/tarefas',
  '/agenda/eventos',
  '/notificacoes',
  '/honorarios',
];

export function isCacheablePath(url) {
  return CACHEABLE_PATHS.some((p) => url.includes(p));
}

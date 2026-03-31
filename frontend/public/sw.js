/* ══════════════════════════════════════════════════════════════
   JuriX — Service Worker
   Cache-first for static assets, network-first for API calls,
   with IndexedDB fallback for offline API responses.
══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'jurix-cache-v1';
const STATIC_CACHE = 'jurix-static-v1';
const API_CACHE = 'jurix-api-v1';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/favicon.svg',
  '/logo.png',
  '/manifest.json',
];

// ─── Install: pre-cache shell ─────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Some URLs may fail on first install, that's OK
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch strategy ───────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension, etc.
  if (!url.protocol.startsWith('http')) return;

  // Skip Vite HMR, source files, and module scripts in dev
  if (url.pathname.includes('/@') || url.pathname.includes('node_modules') ||
      url.pathname.endsWith('.jsx') || url.pathname.endsWith('.tsx') ||
      url.pathname.endsWith('.ts') || url.pathname.endsWith('.mjs')) return;

  // Navigation requests (HTML pages): always network-first
  // This prevents serving stale index.html with outdated asset hashes
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // CDN resources (fonts, FA icons): cache-first
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirstWithNetwork(request));
    return;
  }

  // App shell / static assets: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ─── Network-first (API) ──────────────────────────────────
async function networkFirstWithCache(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetchWithTimeout(request, 15000);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      // Add header to signal this is cached data
      const headers = new Headers(cached.headers);
      headers.set('X-JuriX-Cached', 'true');
      headers.set('X-JuriX-Cache-Date', cached.headers.get('date') || new Date().toISOString());
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    // Return offline JSON response
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Sem conexão com o servidor' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Cache-first (CDN) ────────────────────────────────────
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

// ─── Stale-while-revalidate (static assets) ──────────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached immediately, update in background
  if (cached) {
    fetchPromise;
    return cached;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;

  return new Response('Offline', { status: 503 });
}

// ─── Fetch with timeout ───────────────────────────────────
function fetchWithTimeout(request, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Timeout'));
    }, timeout);

    fetch(request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ─── Listen for messages from the app ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearApiCache') {
    caches.delete(API_CACHE);
  }
});

import axios from 'axios';
import { cacheResponse, getCachedResponse, isCacheablePath } from './offlineCache';
import useConnectionStore from '../store/connectionStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 45000, // 45s default (was 30s — too tight for 4G)
  headers: { 'Content-Type': 'application/json' },
});

// ─── Interceptor: injeta token + ajusta timeout ───
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jurix_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Adjust timeout based on connection quality
  const quality = useConnectionStore.getState().connectionQuality;
  if (quality === 'slow') {
    config.timeout = Math.max(config.timeout || 0, 90000); // 90s for slow connections
  }

  return config;
});

// ─── Retry logic with exponential backoff ─────────
// Retries transient failures (network errors, 502/503/504) up to 3 times
function shouldRetry(error, retryCount) {
  if (retryCount >= 3) return false;
  // Don't retry non-GET mutations (to avoid duplicate writes)
  if (error.config?.method !== 'get') return false;
  // Don't retry auth errors
  if (error.response?.status === 401 || error.response?.status === 403) return false;
  // Retry network errors
  if (!error.response) return true;
  // Retry server errors (gateway/timeout)
  if ([502, 503, 504, 429].includes(error.response?.status)) return true;
  return false;
}

function retryDelay(retryCount) {
  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * Math.pow(2, retryCount), 4000);
}

async function retryRequest(error, retryCount = 0) {
  if (!shouldRetry(error, retryCount)) {
    return Promise.reject(error);
  }
  const delay = retryDelay(retryCount);
  await new Promise((resolve) => setTimeout(resolve, delay));
  const config = { ...error.config, _retryCount: retryCount + 1 };
  // Reset timeout for retry
  delete config.cancelToken;
  delete config.signal;
  return api.request(config).catch((err) => retryRequest(err, retryCount + 1));
}

// ─── Interceptor: trata erros + offline fallback + retry ───
api.interceptors.response.use(
  (res) => {
    // Cache successful GET responses
    if (res.config.method === 'get' && isCacheablePath(res.config.url)) {
      cacheResponse(res.config.url, res.data);
    }

    // Mark connection as good if we got a response
    const store = useConnectionStore.getState();
    if (!store.isOnline) {
      store.setOnline();
    }
    if (store.isUsingCache) {
      store.setIsUsingCache(false);
    }

    return res;
  },
  async (error) => {
    // Auth error — redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('jurix_token');
      localStorage.removeItem('jurix_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Retry transient errors before giving up
    const retryCount = error.config?._retryCount || 0;
    if (shouldRetry(error, retryCount)) {
      return retryRequest(error, retryCount);
    }

    // Network error or timeout — try offline cache for GET requests
    const isNetworkError = !error.response && (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.message?.includes('Network Error'));

    if (isNetworkError && error.config?.method === 'get') {
      const store = useConnectionStore.getState();
      store.setConnectionQuality(navigator.onLine ? 'slow' : 'offline');

      if (!navigator.onLine) {
        store.setOffline();
      }

      // Try IndexedDB cache
      const cached = await getCachedResponse(error.config.url);
      if (cached) {
        store.setIsUsingCache(true);
        return {
          data: cached.data,
          status: 200,
          statusText: 'OK (cached)',
          headers: { 'x-jurix-cached': 'true', 'x-jurix-cache-date': new Date(cached.timestamp).toISOString() },
          config: error.config,
          _cached: true,
          _cacheTimestamp: cached.timestamp,
        };
      }
    }

    // Network error on mutation — mark offline but still reject
    if (isNetworkError) {
      const store = useConnectionStore.getState();
      if (!navigator.onLine) {
        store.setOffline();
      } else {
        store.setConnectionQuality('slow');
      }
    }

    return Promise.reject(error);
  }
);

export default api;

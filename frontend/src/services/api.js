import axios from 'axios';
import { cacheResponse, getCachedResponse, isCacheablePath } from './offlineCache';
import useConnectionStore from '../store/connectionStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Interceptor: injeta token ─────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jurix_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // For slow connections, increase timeout
  const quality = useConnectionStore.getState().connectionQuality;
  if (quality === 'slow') {
    config.timeout = 60000;
  }

  return config;
});

// ─── Interceptor: trata erros + offline fallback ───
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

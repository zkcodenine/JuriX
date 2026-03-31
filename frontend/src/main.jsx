import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { initConnectionListeners } from './store/connectionStore';
import './index.css';

/* ── Efeito ripple global em todos os .btn ─────────── */
document.addEventListener('mousedown', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn || btn.disabled) return;
  const rect   = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple-effect';
  ripple.style.left = `${e.clientX - rect.left - 5}px`;
  ripple.style.top  = `${e.clientY - rect.top  - 5}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
});

/* ── Initialize connection monitoring ─────────────── */
initConnectionListeners();

/* ── Register Service Worker (production only) ────── */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              // New version ready — the page will use it on next load
            }
          });
        });
      })
      .catch(() => {
        // SW registration failed — app works fine without it
      });
  });
} else if ('serviceWorker' in navigator && import.meta.env.DEV) {
  // Unregister any leftover SW from previous builds in dev mode
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error?.response?.status === 401 || error?.response?.status === 403) return false;
        // If offline with cached data, don't retry
        if (error?.config?._cached) return false;
        // Retry up to 2 times for network errors
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,
      // When offline, use cached data without refetching
      networkMode: 'offlineFirst',
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f1f1f',
            color: '#fff',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#C9A84C', secondary: '#0a0a0a' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/* ══════════════════════════════════════════════════════════════════
   O JuriX roda em dois lugares, e o caminho base muda entre eles:

     • Electron / dev  →  "/"               (backend serve a raiz)
     • HostGator       →  "/jurix/"         (https://nossosflows.com.br/jurix)

   Tudo que depende disso (router, chamadas à API, service worker,
   favicon, manifest) lê `import.meta.env.BASE_URL`, que é exatamente
   o valor de `base` abaixo. Assim existe UMA fonte da verdade.

   Para publicar no subdiretório:
       VITE_BASE_PATH=/jurix/ npm run build
   ou deixe VITE_BASE_PATH no frontend/.env.production.
   ══════════════════════════════════════════════════════════════════ */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Normaliza: precisa começar e terminar com "/" para o Vite.
  let base = env.VITE_BASE_PATH || '/';
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';

  return {
    base,
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        '/storage': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
    build: { outDir: 'dist', sourcemap: false },
  };
});

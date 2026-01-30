// frontend/vite.config.ts

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        client: resolve(__dirname, 'client.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        // ВАЖНО: Раскомментировали rewrite!
        // Это превращает запрос "/api/me" в "/me" для бэкенда
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
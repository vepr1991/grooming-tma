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
    host: true, // Нужно для Docker
    proxy: {
      // Все запросы, начинающиеся с /api, отправляем на бэкенд
      '/api': {
        target: 'http://backend:8000', // Имя сервиса из docker-compose
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''), // Убираем префикс /api перед отправкой
      },
    },
  },
});
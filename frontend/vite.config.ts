/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // bind ke 0.0.0.0 — bisa diakses dari device lain di jaringan yang sama
    proxy: {
      // Proxy /api/* to Django backend — makes requests same-origin from browser's POV.
      // Do NOT rewrite paths — Django is configured to receive the /api/* prefix.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});

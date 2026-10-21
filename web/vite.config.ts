/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The build is served by FastAPI from /static/app/ (see cropwise/routers/spa.py).
export default defineConfig({
  base: '/static/app/',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../static/app', emptyOutDir: true, sourcemap: false },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8000', '/static/js': 'http://127.0.0.1:8000', '/static/og.png': 'http://127.0.0.1:8000' },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false },
})

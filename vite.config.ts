import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: process.env.DEMO_BASE_PATH ?? '/',
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
  },
  preview: {
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/support/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
        'src/animation/core/**': { lines: 90, statements: 90, functions: 90, branches: 80 },
      },
    },
  },
  build: {
    outDir: 'dist-demo',
    // Keep dependency cycles in the same chunk; manual UI/vendor groups can execute before
    // their shared helpers and fail during production module initialization.
  },
})

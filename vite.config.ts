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
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
  build: {
    outDir: 'dist-demo',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'framework',
              test: /node_modules[\\/](?:@vue|vue)[\\/]/,
              priority: 4,
              includeDependenciesRecursively: false,
            },
            {
              name: 'visualization',
              test: /node_modules[\\/]d3(?:-[^\\/]+)?[\\/]/,
              priority: 3,
              includeDependenciesRecursively: false,
            },
            {
              name: 'ui',
              test: /node_modules[\\/](?:@ant-design|@popperjs|@vueuse|ant-design-vue|vue3-colorpicker)[\\/]/,
              priority: 2,
              includeDependenciesRecursively: false,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 1,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
})

import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const peerDependencies = ['vue', 'd3']

export default defineConfig({
  plugins: [vue()],
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: { compress: { passes: 3 } },
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        native: fileURLToPath(new URL('./src/native.ts', import.meta.url)),
        vue: fileURLToPath(new URL('./src/vue.ts', import.meta.url)),
      },
      name: 'WaveformAnalysis',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      cssFileName: 'style',
    },
    rolldownOptions: {
      external: (id) =>
        peerDependencies.some((dependency) => id === dependency || id.startsWith(`${dependency}/`)),
    },
  },
})

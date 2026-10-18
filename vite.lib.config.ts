import { fileURLToPath, URL } from 'node:url'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const peerDependencies = ['vue', 'd3']

export default defineConfig({
  // Worker assets must remain relative when the library is consumed from another workspace.
  base: './',
  plugins: [
    vue(),
    {
      name: 'waveform-native-styles',
      async writeBundle(output, bundle) {
        if (!('style.css' in bundle)) return
        const directory = output.dir ?? 'dist'
        await mkdir(resolve(directory, 'native'), { recursive: true })
        await copyFile(resolve(directory, 'style.css'), resolve(directory, 'native/style.css'))
        const shared = ['src/styles/controlTheme.css', 'src/styles/controls.css']
        const number = 'src/components/controls/WaveformNumberInput.css'
        const styles: Record<string, string[]> = {
          'input-number': [...shared, number],
          select: shared,
          'color-picker': [...shared, number, 'src/styles/colorInput.css'],
          pagination: [...shared, 'src/components/controls/WaveformPagination.css'],
          modal: [...shared, 'src/components/controls/WaveformModal.css'],
          popup: [...shared, 'src/styles/popover.css'],
        }
        for (const [name, sources] of Object.entries(styles)) {
          await mkdir(resolve(directory, name), { recursive: true })
          const css = await Promise.all(sources.map((file) => readFile(file, 'utf8')))
          await writeFile(resolve(directory, name, 'style.css'), css.join('\n'))
        }
      },
    },
  ],
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
        'input-number': fileURLToPath(new URL('./src/input-number.ts', import.meta.url)),
        select: fileURLToPath(new URL('./src/select.ts', import.meta.url)),
        'color-picker': fileURLToPath(new URL('./src/color-picker.ts', import.meta.url)),
        pagination: fileURLToPath(new URL('./src/pagination.ts', import.meta.url)),
        modal: fileURLToPath(new URL('./src/modal.ts', import.meta.url)),
        popup: fileURLToPath(new URL('./src/popup.ts', import.meta.url)),

        analysis: fileURLToPath(new URL('./src/analysis.ts', import.meta.url)),
        display: fileURLToPath(new URL('./src/display.ts', import.meta.url)),
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

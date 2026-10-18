import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build, version as viteVersion } from 'vite'

/** Inspect real consumer bundles, not names in minified JavaScript. */
export async function verifyComponentBundles(consumerRoot) {
  const observations = []
  for (const [name, specifier, symbol, forbidden] of [
    ['root-analysis', 'waveform-analysis', 'init', /\/dist\/display-[^/]+\.js$/],
    ['root-display', 'waveform-analysis', 'Waveform', /\/dist\/init-[^/]+\.js$/],
    ['analysis', 'waveform-analysis/analysis', 'init', /\/dist\/display-[^/]+\.js$/],
    ['display', 'waveform-analysis/display', 'Waveform', /\/dist\/init-[^/]+\.js$/],
    [
      'input-number',
      'waveform-analysis/input-number',
      'InputNumber',
      /\/dist\/(init|display|WaveformChart|workerSampling)[^/]*\.js$/,
    ],
    [
      'select',
      'waveform-analysis/select',
      'Select',
      /\/dist\/(init|display|WaveformChart|workerSampling)[^/]*\.js$/,
    ],
    [
      'color-picker',
      'waveform-analysis/color-picker',
      'ColorPicker',
      /\/dist\/(init|display|WaveformChart|workerSampling)[^/]*\.js$/,
    ],
    [
      'pagination',
      'waveform-analysis/pagination',
      'Pagination',
      /\/dist\/(init|display|WaveformChart|workerSampling)[^/]*\.js$/,
    ],
    [
      'modal',
      'waveform-analysis/modal',
      'Modal',
      /\/dist\/(init|display|WaveformChart|workerSampling)[^/]*\.js$/,
    ],
    [
      'popup',
      'waveform-analysis/popup',
      'Popup',
      /\/dist\/(init|display|WaveformChart|workerSampling)[^/]*\.js$/,
    ],
  ]) {
    const entry = join(consumerRoot, name + '.js')
    writeFileSync(entry, `export { ${symbol} } from '${specifier}'\n`)
    let modules = []
    let bytes = 0
    let gzip = 0
    await build({
      configFile: false,
      root: consumerRoot,
      logLevel: 'error',
      build: { write: false, minify: 'terser', lib: { entry, formats: ['es'] } },
      plugins: [
        {
          name: 'verify-component-boundary',
          generateBundle(_, bundle) {
            for (const chunk of Object.values(bundle)) {
              if (chunk.type !== 'chunk') continue
              modules.push(
                ...Object.entries(chunk.modules)
                  .filter(([, info]) => info.renderedLength > 0)
                  .map(([id]) => id),
              )
              bytes += Buffer.byteLength(chunk.code)
              gzip += gzipSync(chunk.code).length
            }
          },
        },
      ],
    })
    modules = [...new Set(modules)]
    assert.ok(
      !modules.some((id) => forbidden.test(id)),
      `${name} retained another component's implementation`,
    )
    observations.push({
      name,
      viteVersion,
      minify: 'terser',
      bytes,
      gzip,
      packageModules: modules
        .filter((id) => id.includes('/waveform-analysis/dist/'))
        .map((id) => id.slice(id.indexOf('/waveform-analysis/dist/'))),
    })
  }
  const packageRoot = join(consumerRoot, 'node_modules/waveform-analysis')
  for (const [name, forbidden] of [
    ['analysis', /display-[^/]+\.cjs$/],
    ['display', /init-[^/]+\.cjs$/],
    ['input-number', /(init|display|WaveformChart|workerSampling)[^/]*\.cjs$/],
    ['select', /(init|display|WaveformChart|workerSampling)[^/]*\.cjs$/],
    ['color-picker', /(init|display|WaveformChart|workerSampling)[^/]*\.cjs$/],
    ['pagination', /(init|display|WaveformChart|workerSampling)[^/]*\.cjs$/],
    ['modal', /(init|display|WaveformChart|workerSampling)[^/]*\.cjs$/],
    ['popup', /(init|display|WaveformChart|workerSampling)[^/]*\.cjs$/],
  ]) {
    const seen = new Set()
    const visit = (file) => {
      if (seen.has(file)) return
      seen.add(file)
      assert.ok(!forbidden.test(file), `CJS ${name} reached another component: ${file}`)
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/require\(["'](\.\/[^"']+)["']\)/g))
        visit(join(dirname(file), match[1]))
    }
    visit(join(packageRoot, 'dist', name + '.cjs'))
  }
  return observations
}

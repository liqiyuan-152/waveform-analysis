import assert from 'node:assert/strict'
import { build, version as viteVersion } from 'vite'
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const evidence = resolve('openspec/changes/integrate-waveform-display-and-component-demos/evidence')
const original = realpathSync(process.env.BASELINE_ANALYSIS_ROOT)
const originalDisplay = realpathSync('../waveform-display')
const root = realpathSync(await mkdtemp(resolve(tmpdir(), 'waveform-bundle-comparison-')))
const results = []
// All cases use the same Vite production consumer, dependency installation and
// settings. Unlike a raw dist inventory, this measures the reachable implementation.
for (const version of ['baseline', 'integrated']) {
  for (const component of ['analysis', 'display', 'both']) {
    const analysisRoot = version === 'baseline' ? original : process.cwd()
    const analysisFile = resolve(
      analysisRoot,
      version === 'baseline' ? 'src/index.ts' : 'src/analysis.ts',
    )
    const displayFile =
      version === 'baseline' ? resolve(originalDisplay, 'src/index.ts') : resolve('src/display.ts')
    const entry = resolve(root, `${version}-${component}.js`)
    const source = [
      component !== 'display' ? `export { init } from ${JSON.stringify(analysisFile)}` : '',
      component !== 'analysis' ? `export { Waveform } from ${JSON.stringify(displayFile)}` : '',
    ].join('\n')
    await writeFile(entry, source)
    const files = [],
      modules = new Set()
    await build({
      configFile: false,
      root,
      logLevel: 'error',
      resolve: { alias: { '@': resolve(analysisRoot, 'src') } },
      build: { write: false, minify: 'terser', lib: { entry, formats: ['es'] } },
      plugins: [
        {
          name: 'record-consumer-output',
          generateBundle(_, bundle) {
            for (const item of Object.values(bundle)) {
              const content = item.type === 'chunk' ? item.code : item.source
              files.push({
                file: item.fileName,
                type: item.type,
                bytes: Buffer.byteLength(content),
                gzip: gzipSync(content).length,
              })
              if (item.type === 'chunk')
                for (const [id, info] of Object.entries(item.modules))
                  if (info.renderedLength > 0) modules.add(id)
            }
          },
        },
      ],
    })
    results.push({
      version,
      component,
      files,
      modules: [...modules],
      gzip: files.reduce((sum, file) => sum + file.gzip, 0),
    })
  }
}
const comparisons = ['analysis', 'display', 'both'].map((component) => {
  const before = results.find(
    (item) => item.version === 'baseline' && item.component === component,
  ).gzip
  const after = results.find(
    (item) => item.version === 'integrated' && item.component === component,
  ).gzip
  const limit = before * 1.5 + 12000
  return { component, baseline: before, integrated: after, limit, passed: after <= limit }
})
await mkdir(evidence, { recursive: true })
const budget = JSON.parse(await readFile(resolve(evidence, 'performance-budget.json'), 'utf8'))
await writeFile(
  resolve(evidence, 'bundle-comparison.json'),
  JSON.stringify(
    {
      viteVersion,
      minify: 'terser',
      budget: budget.bundleBudget,
      method:
        'Same production source consumer; packed entry boundary verified separately by test:package. Worker/WASM data URLs, when inlined by Vite library mode, are included in JS bytes.',
      results,
      comparisons,
    },
    null,
    2,
  ) + '\n',
)
assert.ok(
  comparisons.every((item) => item.passed),
  'Component bundle budget exceeded',
)
console.log(JSON.stringify(comparisons, null, 2))

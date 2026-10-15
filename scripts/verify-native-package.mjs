import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'waveform-native-consumer-'))
const run = (args, cwd = process.cwd()) =>
  execFileSync('corepack', ['pnpm@10.32.1', ...args], { cwd, stdio: 'inherit' })
// Check precisely the already-built outputs; a final release gate still executes prepack/build.
run(['--config.ignore-scripts=true', 'pack', '--pack-destination', directory])
const archive = readdirSync(directory).find((name) => name.endsWith('.tgz'))
if (!archive) throw new Error('Package archive missing')
writeFileSync(
  join(directory, 'package.json'),
  JSON.stringify({
    private: true,
    dependencies: { 'waveform-analysis': `file:${join(directory, archive)}` },
    devDependencies: { typescript: '6.0.3' },
  }),
)
writeFileSync(join(directory, '.npmrc'), 'auto-install-peers=false\n')
run(['install', '--ignore-scripts', '--strict-peer-dependencies'], directory)
const modules = join(directory, 'node_modules')
for (const name of ['vue', 'vue-router', 'vue3-colorpicker', 'react', 'ant-design-vue'])
  if (existsSync(join(modules, name))) throw new Error(`Unexpected native dependency: ${name}`)

const runtime = `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import * as esm from 'waveform-analysis/native'
import * as root from 'waveform-analysis'
const require = createRequire(import.meta.url)
const cjs = require('waveform-analysis/native')
const cjsRoot = require('waveform-analysis')
for (const [main, alias] of [[root, esm], [cjsRoot, cjs]]) {
  assert.equal('WaveformChart' in main, false)
  assert.deepEqual(Object.keys(main).sort(), Object.keys(alias).sort())
  for (const name of Object.keys(main)) assert.equal(main[name], alias[name], name)
  for (const name of ['init', 'getInstanceByDom', 'dispose']) assert.equal(typeof main[name], 'function')
}
assert.equal(typeof globalThis.window, 'undefined')
for (const entry of [esm, cjs]) {
  assert.deepEqual(entry.normalizeWaveformData({kind:'samples', values:[1,2], sampleRate:2}),
    [{x:0,y:1},{x:0.5,y:2}])
  assert.equal(entry.globalAnimator.getAnimationCount(), 0)
}
console.log('ESM/CJS root and native alias share every runtime export without browser globals or frameworks')
`
writeFileSync(join(directory, 'runtime.mjs'), runtime)
execFileSync(process.execPath, [join(directory, 'runtime.mjs')], { stdio: 'inherit' })
writeFileSync(
  join(directory, 'consumer.ts'),
  `import {type WaveformChartInstance, type WaveformChartOptions, type WaveformChartEvents,
    normalizeWaveformData, init, type WaveformChartProps} from 'waveform-analysis'
import {init as nativeInit, type WaveformChartInstance as NativeInstance} from 'waveform-analysis/native'
const sameSignature: typeof init = nativeInit
const sameInstance = (chart: NativeInstance): WaveformChartInstance => chart
// @ts-expect-error Vue components must be imported from the Vue adapter entry.
import {WaveformChart} from 'waveform-analysis'
void [sameSignature, sameInstance, WaveformChart]
const options: WaveformChartOptions = {}
const props: WaveformChartProps = {data:{kind:'points',points:[]}}
function check(chart: WaveformChartInstance) {
  chart.on('page-change', (page, count) => { const pair: WaveformChartEvents['page-change'] = [page,count]; return pair })
  chart.setOption(props)
}
void [options, check, normalizeWaveformData]
`,
)
writeFileSync(
  join(directory, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      skipLibCheck: false,
      noEmit: true,
    },
    include: ['consumer.ts'],
  }),
)
run(['exec', 'tsc', '-p', 'tsconfig.json'], directory)
for (const path of [
  'THIRD_PARTY_NOTICES.md',
  'dist/index.js',
  'dist/native.js',
  'dist/native.cjs',
  'dist/style.css',
  'dist/native/style.css',
])
  if (!existsSync(resolve(modules, 'waveform-analysis', path))) throw new Error(`Missing ${path}`)
const packageRoot = resolve(modules, 'waveform-analysis')
if (
  !readFileSync(resolve(packageRoot, 'dist/style.css')).equals(
    readFileSync(resolve(packageRoot, 'dist/native/style.css')),
  )
)
  throw new Error('Root and native stylesheets differ')
for (const path of ['tests', 'dist/types/demo', 'dist/types/views', 'dist/types/router.d.ts'])
  if (existsSync(resolve(packageRoot, path)))
    throw new Error(`Unexpected packaged artifact: ${path}`)
console.log(
  `Isolated native runtime, declarations, dependency tree and assets verified: ${directory}`,
)

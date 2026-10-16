import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { build, preview } from 'vite'
import { verifyPackageNativeControls } from './verify-package-native-controls.mjs'
import { packageManagerInvocation } from './package-manager.mjs'

const pnpmCli = process.env.npm_execpath
if (!pnpmCli || !basename(pnpmCli).startsWith('pnpm')) {
  throw new Error('test:package must be run through pnpm so it can invoke the active pnpm CLI.')
}

function runPnpm(args, cwd = process.cwd()) {
  const invocation = packageManagerInvocation(pnpmCli, args)
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed.`)
}

const temporaryRoot = realpathSync(mkdtempSync(join(tmpdir(), 'waveform-analysis-package-')))
const consumerRoot = join(temporaryRoot, 'consumer')
mkdirSync(consumerRoot)
runPnpm(['pack', '--pack-destination', temporaryRoot])

const packageFile = readdirSync(temporaryRoot)
  .filter((fileName) => fileName.endsWith('.tgz'))
  .map((fileName) => resolve(temporaryRoot, fileName))
  .at(0)
if (!packageFile) throw new Error('pnpm pack did not create a package tarball.')

writeFileSync(
  join(temporaryRoot, 'package.json'),
  JSON.stringify(
    {
      private: true,
      packageManager: 'pnpm@10.32.1',
      dependencies: { 'waveform-analysis': `file:${packageFile}`, vue: '3.5.40' },
      devDependencies: { typescript: '~6.0.0' },
    },
    null,
    2,
  ),
)
runPnpm(['install', '--ignore-scripts', '--strict-peer-dependencies=false'], temporaryRoot)

for (const relativePath of [
  'THIRD_PARTY_NOTICES.md',
  'dist/index.js',
  'dist/index.cjs',
  'dist/style.css',
  'dist/types/index.d.ts',
  'dist/types/wasm/waveform_sampling_wasm.d.ts',
  'dist/types/wasm/waveform_sampling_wasm_bg.wasm.d.ts',
]) {
  const path = join(temporaryRoot, 'node_modules/waveform-analysis', relativePath)
  if (!existsSync(path)) throw new Error(`Package is missing ${relativePath}.`)
}

writeFileSync(
  join(temporaryRoot, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        skipLibCheck: false,
        noEmit: true,
      },
      include: ['consumer/**/*.ts'],
    },
    null,
    2,
  ),
)
writeFileSync(
  join(consumerRoot, 'index.ts'),
  `import {
  normalizeWaveformData,
  getEasingFunction,
  type AnimationConfig,
  type AnimationScheduler,
  type AnimationHandle,
  type Animator,
  type WaveformAnimationProps,
  type WaveformAnimationControllerOptions,
  type GeometryTransitionFrame,
  type WasmSamplingRequest,
  type WaveformData,
  type WaveformAxesOptions,
  type WaveformChartHandle,
  type WaveformControlResult,
  type WaveformInteractionMode,
  type WaveformToolbarOptions,
  type WaveformZoomEndPayload,
} from 'waveform-analysis'

function verifyControls(chart: WaveformChartHandle) {
  const oldReset: void = chart.resetViewport(0)
  const oldSet: void = chart.setViewportDomain([0, 1], 0)
  const result: WaveformControlResult = chart.zoomIn({ trackId: 'channel-a' })
  const reset: WaveformControlResult = chart.resetViewport({})
  const mode: WaveformInteractionMode = 'pan'
  chart.setInteractionMode(mode)
  const image: Promise<Blob> = chart.exportImage({ format: 'svg' })
  const toolbar: WaveformToolbarOptions = { items: ['pan', 'reset', 'export'] }
  const payload: WaveformZoomEndPayload = { start: 0, end: 1, gesture: 'command', action: 'fit' }
  return { oldReset, oldSet, result, reset, image, toolbar, payload }
}
void verifyControls
const animation: AnimationConfig = {
  tracks: [{ target: { x: [0, 1] }, property: 'x', to: [1, 2] }],
  easing: 'quartInOut',
  during: (_, frame) => { const terminal: boolean = frame.terminal; void terminal },
}
const animationProps: WaveformAnimationProps = { animation: { enabled: false } }
const settled: GeometryTransitionFrame = { kind: 'settled', values: { x: [1, 2] } }
function verifyAnimation(animator: Animator, scheduler: AnimationScheduler) {
  const handle: AnimationHandle = animator.animate(animation)
  const options: WaveformAnimationControllerOptions = { animator, commitFinalState: () => {} }
  scheduler.setTimer(() => handle.finish(), 0)
  return { options, settled, animationProps }
}
void verifyAnimation
getEasingFunction('quintIn')(0.5)
const axes: WaveformAxesOptions = { y: { nice: false, maximumTickVisible: true, minimumTickVisible: false, upperPaddingEnabled: true, lowerPaddingEnabled: true, upperPaddingRatio: 0.1, lowerPaddingRatio: 0.1 } }
const legacyAxes: WaveformAxesOptions = { y: { upperPaddingRatio: 0.1 } }
void axes
void legacyAxes
const data: WaveformData = { kind: 'samples' , values: [1, 2], sampleRate: 1 }
const request: WasmSamplingRequest = {
  x: new Float64Array([0, 1]),
  y: new Float64Array([1, 2]),
  strategy: 'peak',
  targetPointCount: 2,
}

normalizeWaveformData(data)
void request
`,
)
writeFileSync(
  join(consumerRoot, 'animation.ts'),
  readFileSync(new URL('./package-animation-consumer.ts', import.meta.url)),
)
writeFileSync(
  join(consumerRoot, 'entries.ts'),
  readFileSync(new URL('./package-entry-consumer.ts', import.meta.url)),
)
writeFileSync(
  join(consumerRoot, 'entries.mjs'),
  readFileSync(new URL('./package-entry-runtime.mjs', import.meta.url)),
)
runPnpm(['exec', 'tsc', '--project', 'tsconfig.json'], temporaryRoot)
runPnpm(['exec', 'node', 'consumer/entries.mjs'], temporaryRoot)

writeFileSync(
  join(consumerRoot, 'esm.mjs'),
  "import { normalizeWaveformData, getEasingFunction } from 'waveform-analysis'\nnormalizeWaveformData({ kind: 'samples', values: [1], sampleRate: 1 })\nif (getEasingFunction('quartIn')(0.5) !== 0.0625) throw new Error('Invalid ESM easing export')\n",
)
writeFileSync(
  join(consumerRoot, 'cjs.cjs'),
  "const { normalizeWaveformData, getEasingFunction } = require('waveform-analysis')\nnormalizeWaveformData({ kind: 'samples', values: [1], sampleRate: 1 })\nif (getEasingFunction('quintIn')(0.5) !== 0.03125) throw new Error('Invalid CJS easing export')\n",
)
writeFileSync(
  join(consumerRoot, 'verify-animation.mjs'),
  readFileSync(new URL('./package-animation-runtime.mjs', import.meta.url)),
)
writeFileSync(
  join(consumerRoot, 'animation-esm.mjs'),
  "import * as api from 'waveform-analysis'\nimport { verifyAnimationExports } from './verify-animation.mjs'\nverifyAnimationExports(api)\n",
)
writeFileSync(
  join(consumerRoot, 'animation-cjs.cjs'),
  "import('./verify-animation.mjs').then(({ verifyAnimationExports }) => verifyAnimationExports(require('waveform-analysis')))\n",
)
runPnpm(['exec', 'node', 'consumer/animation-esm.mjs'], temporaryRoot)
runPnpm(['exec', 'node', 'consumer/animation-cjs.cjs'], temporaryRoot)
runPnpm(['exec', 'node', 'consumer/esm.mjs'], temporaryRoot)
runPnpm(['exec', 'node', 'consumer/cjs.cjs'], temporaryRoot)

const manifest = JSON.parse(
  readFileSync(join(temporaryRoot, 'node_modules/waveform-analysis/package.json')),
)
if (manifest.dependencies?.['ant-design-vue'] || manifest.peerDependencies?.['ant-design-vue'])
  throw new Error('Packed component still requires ant-design-vue.')
const installed = readdirSync(join(temporaryRoot, 'node_modules/.pnpm'))
if (installed.some((name) => name.startsWith('ant-design-vue@') || name.startsWith('@ant-design+')))
  throw new Error('Independent consumer transitively installed Ant Design.')
for (const file of ['dist/index.js', 'dist/index.cjs', 'dist/style.css']) {
  const content = readFileSync(join(temporaryRoot, 'node_modules/waveform-analysis', file), 'utf8')
  if (/ant-design-vue|\.ant-(modal|pagination|input-number)/.test(content))
    throw new Error(`Packed ${file} retains antd runtime or style dependencies.`)
}
console.log(`Independent consumer without antd: ${temporaryRoot}`)

if (manifest.name !== 'waveform-analysis')
  throw new Error('Consumer installed an unexpected package.')

// Validate the packed ESM's pure annotations, not just the source tree's tree shaking.
const shakeEntry = join(consumerRoot, 'shake.mjs')
writeFileSync(
  shakeEntry,
  "import { getEasingFunction } from 'waveform-analysis'\nconsole.log(getEasingFunction('linear')(0.5))\n",
)
const shaken = await build({
  configFile: false,
  build: {
    write: false,
    minify: false,
    lib: { entry: shakeEntry, formats: ['es'] },
    rolldownOptions: { external: ['d3', 'vue', 'vue3-colorpicker'] },
  },
})
const shakeCode = shaken[0].output
  .filter((chunk) => chunk.type === 'chunk')
  .map((chunk) => chunk.code)
  .join('')
if (shakeCode.includes('waveform-chart__') || /from\s*['"]vue['"]/.test(shakeCode))
  throw new Error('Packed easing consumer retained chart code or UI peers; pure annotations lost.')

// Build the packed public entry in the consumer's dependency graph, with no demo or source alias.
writeFileSync(
  join(temporaryRoot, 'controls.ts'),
  readFileSync(new URL('./package-native-controls-consumer.ts', import.meta.url)),
)
writeFileSync(
  join(temporaryRoot, 'index.html'),
  '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:24px"><div id="chart"></div><script type="module" src="/controls.ts"></script></body></html>',
)
await build({ root: temporaryRoot, configFile: false, build: { outDir: 'browser-dist' } })
const server = await preview({
  root: temporaryRoot,
  configFile: false,
  build: { outDir: 'browser-dist' },
  preview: { host: '127.0.0.1', port: 0 },
})
try {
  await verifyPackageNativeControls(server.resolvedUrls.local[0])
} finally {
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  )
}

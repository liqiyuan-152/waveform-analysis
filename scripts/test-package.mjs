import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const pnpmCli = process.env.npm_execpath
if (!pnpmCli || !basename(pnpmCli).startsWith('pnpm')) {
  throw new Error('test:package must be run through pnpm so it can invoke the active pnpm CLI.')
}

function runPnpm(args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [pnpmCli, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed.`)
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'waveform-analysis-package-'))
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
      dependencies: { 'waveform-analysis': `file:${packageFile}` },
      devDependencies: { typescript: '~6.0.0' },
    },
    null,
    2,
  ),
)
runPnpm(['install', '--ignore-scripts', '--strict-peer-dependencies=false'], temporaryRoot)

for (const relativePath of [
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
  type WasmSamplingRequest,
  type WaveformData,
} from 'waveform-analysis'

const data: WaveformData = { kind: 'samples', values: [1, 2], sampleRate: 1 }
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
runPnpm(['exec', 'tsc', '--project', 'tsconfig.json'], temporaryRoot)

writeFileSync(
  join(consumerRoot, 'esm.mjs'),
  "import { normalizeWaveformData } from 'waveform-analysis'\nnormalizeWaveformData({ kind: 'samples', values: [1], sampleRate: 1 })\n",
)
writeFileSync(
  join(consumerRoot, 'cjs.cjs'),
  "const { normalizeWaveformData } = require('waveform-analysis')\nnormalizeWaveformData({ kind: 'samples', values: [1], sampleRate: 1 })\n",
)
runPnpm(['exec', 'node', 'consumer/esm.mjs'], temporaryRoot)
runPnpm(['exec', 'node', 'consumer/cjs.cjs'], temporaryRoot)

const manifest = JSON.parse(
  readFileSync(join(temporaryRoot, 'node_modules/waveform-analysis/package.json')),
)
if (manifest.name !== 'waveform-analysis')
  throw new Error('Consumer installed an unexpected package.')

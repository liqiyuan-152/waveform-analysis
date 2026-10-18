import { verifyUnifiedBrowserConsumer } from './verify-unified-browser-consumer.mjs'
import { verifyComponentBundles } from './verify-component-bundles.mjs'
import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

// A separate consumer has no Vue dependency or ancestor workspace node_modules.
export async function verifyUnifiedPackage(tarball) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'waveform-native-consumer-')))
  const run = (args) => {
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stdout + result.stderr)
    return result.stdout
  }
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      type: 'module',
      private: true,
      dependencies: { 'waveform-analysis': `file:${tarball}` },
    }),
  )
  const installed = spawnSync(
    'pnpm',
    ['install', '--ignore-scripts', '--config.auto-install-peers=false'],
    { cwd: root, encoding: 'utf8' },
  )
  if (installed.status !== 0) throw new Error(installed.stdout + installed.stderr)
  writeFileSync(
    join(root, 'verify.mjs'),
    `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
assert.throws(() => require.resolve('vue'))
globalThis.requestAnimationFrame = () => { throw new Error('Import started animation') }
for (const format of ['esm', 'cjs']) {
  const load = name => format === 'esm' ? import(name) : require(name)
  const root = await load('waveform-analysis')
  const native = await load('waveform-analysis/native')
  const analysis = await load('waveform-analysis/analysis')
  const display = await load('waveform-analysis/display')
  assert.equal(typeof (await load('waveform-analysis/input-number')).InputNumber, 'function')
  assert.ok(require.resolve('waveform-analysis/input-number/style.css'))
  assert.equal(typeof (await load('waveform-analysis/select')).Select, 'function')
  assert.ok(require.resolve('waveform-analysis/select/style.css'))
  assert.equal(typeof (await load('waveform-analysis/color-picker')).ColorPicker, 'function')
  assert.ok(require.resolve('waveform-analysis/color-picker/style.css'))
  assert.equal(typeof (await load('waveform-analysis/pagination')).Pagination, 'function')
  assert.ok(require.resolve('waveform-analysis/pagination/style.css'))
  assert.equal(typeof (await load('waveform-analysis/modal')).Modal, 'function')
  assert.ok(require.resolve('waveform-analysis/modal/style.css'))
  assert.equal(typeof (await load('waveform-analysis/popup')).Popup, 'function')
  assert.ok(require.resolve('waveform-analysis/popup/style.css'))

  assert.equal(root.init, analysis.init)
  assert.equal(root.getInstanceByDom, analysis.getInstanceByDom)
  assert.equal(root.dispose, analysis.dispose)
  assert.equal(root.Waveform, display.Waveform)
  assert.equal(root.Waveform, native.Waveform)
  assert.equal(root.globalAnimator, analysis.globalAnimator)
  assert.equal(root.waveformDisplayDefaultOptions, display.defaultOptions)
}
console.log('No-Vue ESM/CJS imports and cross-entry identities passed')
`,
  )
  const output = run([join(root, 'verify.mjs')])
  writeFileSync(
    join(root, 'display-public-types.ts'),
    readFileSync(resolve('tests/fixtures/package/display-public-types.ts')),
  )
  writeFileSync(
    join(root, 'consumer.ts'),
    `
import { init, Waveform, type WaveformDisplayOptions, type WaveformData } from 'waveform-analysis'
import { init as analysisInit } from 'waveform-analysis/analysis'
import { Waveform as Display, type WaveformOptions } from 'waveform-analysis/display'
const options: WaveformDisplayOptions & WaveformOptions = { animation: { duration: 10 } }
const data: WaveformData = { kind: 'points', points: [] }
void [init, analysisInit, Waveform, Display, options, data]
import { InputNumber } from 'waveform-analysis/input-number'
void InputNumber
import { Select } from 'waveform-analysis/select'
void Select
import { ColorPicker } from 'waveform-analysis/color-picker'
void ColorPicker
import { Pagination } from 'waveform-analysis/pagination'
void Pagination
import { Modal } from 'waveform-analysis/modal'
void Modal
import { Popup } from 'waveform-analysis/popup'
void Popup

`,
  )
  writeFileSync(
    join(root, 'controls-public-types.ts'),
    readFileSync(resolve('tests/fixtures/package/controls-public-types.ts')),
  )
  for (const [module, moduleResolution] of [
    ['ESNext', 'Bundler'],
    ['NodeNext', 'NodeNext'],
    ['ESNext', 'Node10'],
  ]) {
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module,
          moduleResolution,
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          ignoreDeprecations: '6.0',
          types: [],
          lib: ['ES2022', 'DOM'],
        },
        files: ['consumer.ts', 'display-public-types.ts', 'controls-public-types.ts'],
      }),
    )
    run([resolve('node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.json')])
  }
  assert.ok(readdirSync(join(root, 'node_modules')).includes('waveform-analysis'))
  const manifest = JSON.parse(
    readFileSync(join(root, 'node_modules/waveform-analysis/package.json')),
  )
  assert.deepEqual(manifest.sideEffects, ['**/*.css'])
  console.log(output.trim(), '\nNo-Vue declarations passed (Bundler/NodeNext/Node10)')
  const bundles = await verifyComponentBundles(root)
  writeFileSync(
    join(process.env.WAVEFORM_EVIDENCE_DIR ?? root, 'package-bundles.json'),
    JSON.stringify(bundles, null, 2) + '\n',
  )
  console.log('Real ESM tree shaking and CJS component boundaries passed')
  await verifyUnifiedBrowserConsumer(root)
  return root
}

if (process.argv[2]) await verifyUnifiedPackage(resolve(process.argv[2]))

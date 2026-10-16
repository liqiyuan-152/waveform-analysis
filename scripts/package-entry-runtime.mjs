import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const modules = ['waveform-analysis', 'waveform-analysis/native', 'waveform-analysis/vue']
for (const specifier of modules) {
  const esm = await import(specifier)
  const cjs = require(specifier)
  if (specifier.endsWith('/vue')) {
    assert.equal(typeof esm.WaveformChart.setup, 'function')
    assert.equal(typeof cjs.WaveformChart.setup, 'function')
  } else {
    assert.equal(typeof esm.init, 'function')
    assert.equal(typeof cjs.init, 'function')
    assert.deepEqual(esm.normalizeWaveformData({ kind: 'samples', values: [1], sampleRate: 1 }), [
      { x: 0, y: 1 },
    ])
  }
}
const css = ['waveform-analysis/style.css', 'waveform-analysis/native/style.css']
for (const specifier of css) {
  assert.equal(import.meta.resolve(specifier), pathToFileURL(require.resolve(specifier)).href)
}
assert.equal(
  readFileSync(require.resolve(css[0]), 'utf8'),
  readFileSync(require.resolve(css[1]), 'utf8'),
)
const root = await import('waveform-analysis')
const native = await import('waveform-analysis/native')
assert.equal(root.init, native.init)
console.log('Three ESM/CJS entries and both CSS exports verified.')

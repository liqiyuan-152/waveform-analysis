import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'waveform-vue-consumer-'))
const vueVersion = process.env.WAVEFORM_CONSUMER_VUE_VERSION || '3.5.40'
const typescriptVersion = process.env.WAVEFORM_CONSUMER_TYPESCRIPT_VERSION || '6.0.3'
const run = (args, cwd = process.cwd()) =>
  execFileSync('corepack', ['pnpm@10.32.1', ...args], { cwd, stdio: 'inherit' })
run(['--config.ignore-scripts=true', 'pack', '--pack-destination', directory])
const archive = readdirSync(directory).find((name) => name.endsWith('.tgz'))
if (!archive) throw new Error('Package archive missing')
writeFileSync(
  join(directory, 'package.json'),
  JSON.stringify({
    private: true,
    type: 'module',
    dependencies: { 'waveform-analysis': `file:${join(directory, archive)}`, vue: vueVersion },
    devDependencies: { typescript: typescriptVersion },
  }),
)
writeFileSync(join(directory, '.npmrc'), 'auto-install-peers=false\n')
run(['install', '--ignore-scripts', '--strict-peer-dependencies'], directory)
writeFileSync(
  join(directory, 'runtime.mjs'),
  `import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import * as root from 'waveform-analysis'
import * as native from 'waveform-analysis/native'
import { WaveformChart as adapter } from 'waveform-analysis/vue'
const require = createRequire(import.meta.url)
assert.equal('WaveformChart' in root, false)
assert.equal(root.init, native.init)
assert.equal(require('waveform-analysis').WaveformChart, undefined)
assert.equal(require('waveform-analysis').init, require('waveform-analysis/native').init)
assert.equal(typeof globalThis.window, 'undefined')
for (const component of [adapter, require('waveform-analysis/vue').WaveformChart]) {
  const html = await renderToString(h(component, {data:{kind:'points',points:[]}}))
  assert.match(html, /waveform-chart-host/)
  assert.doesNotMatch(html, /<svg/)
}
console.log('Vue ESM/CJS adapter SSR and separate native root verified')
`,
)
execFileSync(process.execPath, [join(directory, 'runtime.mjs')], { stdio: 'inherit' })
writeFileSync(
  join(directory, 'consumer.ts'),
  `import { WaveformChart, type WaveformChartProps, type WaveformChartHandle } from 'waveform-analysis/vue'
import { h } from 'vue'
const props: WaveformChartProps = { data: { kind: 'points', points: [] } }
const vnode = h(WaveformChart, props)
declare const component: InstanceType<typeof WaveformChart>
component.zoomIn({trackId:'a'})
component.$emit('page-change', 1, 2)
// @ts-expect-error Event tuples must retain both page arguments.
component.$emit('page-change', 1)
// @ts-expect-error The chart data contract is required by the Vue component.
const missingData: InstanceType<typeof WaveformChart>['$props'] = {}
function useHandle(chart: WaveformChartHandle) {
  chart.setViewportDomain([0, 1], 0)
  chart.setViewportDomain([0, 1], {trackId:'a'})
  chart.resetViewport(0)
  chart.resetViewport({trackId:'a'})
  return chart.exportImage({format:'svg'})
}
void [vnode, useHandle, missingData]
`,
)
writeFileSync(
  join(directory, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: Number(typescriptVersion.split('.')[0]) < 5 ? 'Node' : 'Bundler',
      strict: true,
      skipLibCheck: false,
      noEmit: true,
    },
    include: ['consumer.ts'],
  }),
)
run(['exec', 'tsc', '-p', 'tsconfig.json'], directory)
console.log(`Isolated Vue ${vueVersion} adapter declarations verified: ${directory}`)

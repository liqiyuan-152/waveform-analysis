import { build } from 'vite'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  copyFileSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { collectGzipSizes, compareGzipSizes } from './animation-gzip-report.mjs'

const baselineCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const baseline = mkdtempSync(join(tmpdir(), 'waveform-animation-gzip-'))
const archive = join(baseline, 'source.tar')
execFileSync('git', ['archive', '--format=tar', '--output', archive, baselineCommit])
execFileSync('tar', ['-xf', archive, '-C', baseline])
symlinkSync(join(process.cwd(), 'node_modules'), join(baseline, 'node_modules'))
copyFileSync('vite.lib.config.ts', join(baseline, 'vite.lib.config.ts'))
cpSync('wasm/pkg', join(baseline, 'wasm/pkg'), { recursive: true })
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const configSha256 = sha('vite.lib.config.ts')
const wasmSha256 = sha('wasm/pkg/waveform_sampling_wasm_bg.wasm')
if (
  configSha256 !== sha(join(baseline, 'vite.lib.config.ts')) ||
  wasmSha256 !== sha(join(baseline, 'wasm/pkg/waveform_sampling_wasm_bg.wasm'))
)
  throw new Error('Baseline inputs differ')
await build({ root: baseline, configFile: join(baseline, 'vite.lib.config.ts') })
await build({ configFile: 'vite.lib.config.ts' })
const { results, additionalFiles, totals } = compareGzipSizes(
  collectGzipSizes(join(baseline, 'dist')),
  collectGzipSizes('dist'),
)
const evidence = {
  baselineCommit,
  baselineDirectory: baseline,
  configuration:
    'Identical final vite.lib.config.ts and current dependency graph for both builds, identical prepared WASM, node:zlib gzip defaults.',
  configSha256,
  wasmSha256,
  dependencyLockSha256: sha('pnpm-lock.yaml'),
  nodeVersion: process.version,
  accounting: 'Recursive file union; each format total includes CSS and all additional outputs.',
  results,
  additionalFiles,
  totals,
}
writeFileSync(
  'openspec/changes/add-animation-system/evidence/gzip-results.json',
  JSON.stringify(evidence, null, 2),
)
console.log(results)
console.log(totals)

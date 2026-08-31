import { spawnSync } from 'node:child_process'

if (process.argv.includes('--help')) {
  console.info(`Usage: node scripts/wasm-sampling-baseline.mjs

Runs the repeatable Node baseline for 10 independent series of 100,000 points.
The JSON report includes environment, normalization, domain scan, visible-range,
peak selection, SVG path generation, hover lookup, render density, and memory.

For a browser trace, run pnpm dev and open:
http://localhost:5173/scripts/wasm-sampling-baseline.html`)
  process.exit(0)
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = spawnSync(
  command,
  ['vitest', 'run', 'scripts/wasm-sampling-baseline.test.ts', '--disableConsoleIntercept'],
  {
    stdio: 'inherit',
    env: { ...process.env, WAVEFORM_BASELINE_REPORT: '1' },
  },
)

if (result.error) throw result.error
process.exitCode = result.status ?? 1

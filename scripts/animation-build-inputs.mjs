import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** Identify the production inputs, including tracked and newly implemented source files. */
export function animationBuildInputs() {
  const files = [
    ...execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'demo-app'],
      {
        encoding: 'utf8',
      },
    )
      .trim()
      .split('\n'),
    'vite.config.ts',
    'package.json',
    'pnpm-lock.yaml',
    'scripts/animation-browser-server.mjs',
    'tests/browser/animation.ts',
    'tests/browser/animation.html',
    'wasm/pkg/waveform_sampling_wasm_bg.wasm',
  ].sort()
  const hash = createHash('sha256')
  for (const file of files) hash.update(file).update('\0').update(readFileSync(file)).update('\0')
  return { files, sha256: hash.digest('hex') }
}

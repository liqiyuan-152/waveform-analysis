import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflows = ['.github/workflows/ci.yml', '.gitea/workflows/package.yml']

describe('browser gates', () => {
  it.each(workflows)('%s rejects browser failures before publishing', (file) => {
    const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    const steps = source.split(/\n {6}- /)
    const step = steps.find((item) => item.includes('pnpm test:browser'))!
    expect(step).toBeDefined()
    expect(step).not.toMatch(/continue-on-error|if:/)
    const gate = source.indexOf('pnpm test:browser')
    expect(gate).toBeLessThan(source.indexOf('pnpm test:package'))
    for (const publish of ['pnpm publish', 'npm publish', 'name: Publish', 'name: Deploy']) {
      if (source.includes(publish)) expect(gate).toBeLessThan(source.indexOf(publish))
    }
    const run = step.includes('run: |')
      ? step
          .split('run: |\n')[1]!
          .split('\n')
          .filter((line) => line.startsWith('          '))
          .map((line) => line.slice(10))
          .join('\n')
      : step.match(/run: (.+)/)![1]!
    const root = mkdtempSync(join(tmpdir(), 'waveform-browser-gate-'))
    try {
      const shim = join(root, 'pnpm')
      writeFileSync(
        shim,
        '#!/bin/sh\nif [ "$1" = test:browser ] || [ "$1" = test:browser:built ]; then echo "$FAILURE_KIND"; exit "$FAILURE_CODE"; fi\n',
      )
      chmodSync(shim, 0o755)
      for (const [failure, code] of [
        ['browser-install-or-launch', '1'],
        ['assertion', '2'],
        ['timeout', '124'],
      ]) {
        const shimDirectory = root.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1')
        const result = spawnSync(
          'bash',
          ['-e', '-c', `export PATH='${shimDirectory}':"$PATH"\n${run}\necho PUBLISH_SENTINEL`],
          {
            cwd: root,
            encoding: 'utf8',
            env: {
              ...process.env,
              FAILURE_KIND: failure,
              FAILURE_CODE: code,
            },
          },
        )
        expect(result.status).toBe(Number(code))
        expect(result.stdout).not.toContain('PUBLISH_SENTINEL')
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('uploads release browser evidence from the job that produces it', () => {
    const source = readFileSync('.github/workflows/ci.yml', 'utf8')
    const releaseJob = source.split('  deploy-demo:')[0]!
    expect(releaseJob).toContain('pnpm test:browser')
    expect(releaseJob).toContain('name: Retain browser diagnostics')
    expect(releaseJob).toContain('path: artifacts/browser')
  })

  it('requires the weekly cross-browser matrix and retained diagnostics', () => {
    const source = readFileSync('.github/workflows/browser-regression.yml', 'utf8')
    expect(source).toContain('workflow_dispatch:')
    expect(source).toContain('schedule:')
    expect(source).toContain('browser: [chromium, firefox, webkit]')
    expect(source).toContain('pnpm test:browser:resources')
    expect(source).toContain('if: always()')
    expect(source).not.toContain('continue-on-error')
  })
})

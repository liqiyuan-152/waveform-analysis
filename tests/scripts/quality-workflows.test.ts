import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const checks = ['check:native-boundary', 'check:licenses', 'typecheck:examples']
const workflows = ['.github/workflows/verify.yml', '.gitea/workflows/package.yml']

describe('quality gates before packaging or publishing', () => {
  it('requires either successful fallback verification or a verified CI artifact before publishing', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
    const release = readFileSync('.github/workflows/release.yml', 'utf8')
    const verify = readFileSync('.github/workflows/verify.yml', 'utf8')
    expect(ci).toContain('uses: ./.github/workflows/verify.yml')
    expect(release).toContain('uses: ./.github/workflows/verify.yml')
    expect(release).toContain('needs: [prepare, verify]')
    expect(release).toContain("needs.verify.result == 'success'")
    expect(release).toContain(
      "needs.verify.result == 'skipped' && needs.prepare.outputs.run_id != ''",
    )
    expect(release.indexOf('node scripts/release-artifacts.mjs verify')).toBeLessThan(
      release.indexOf('pnpm test:package'),
    )
    expect(release.indexOf('pnpm test:package')).toBeLessThan(release.indexOf('npm publish'))
    expect(verify.indexOf('pnpm test:package')).toBeLessThan(
      verify.indexOf('node scripts/release-artifacts.mjs seal'),
    )
    expect(verify.indexOf('node scripts/release-artifacts.mjs seal')).toBeLessThan(
      verify.indexOf('name: Retain verified release artifacts'),
    )
    expect(release).not.toMatch(/pnpm build|pnpm test:coverage|ignore-scripts=true pack/)
  })

  it.each(workflows)('%s stops the job when any quality check fails', (file) => {
    const source = readFileSync(file, 'utf8')
    const header = '      - name: Verify native boundary, licenses and examples\n'
    const index = source.indexOf(header)
    expect(index).toBeGreaterThan(0)
    expect(index).toBeGreaterThan(source.indexOf('pnpm typecheck'))
    expect(index).toBeLessThan(source.indexOf('pnpm test:package'))
    const step = source.slice(index + header.length).split(/\n {6}- /)[0]!
    expect(step).not.toContain('continue-on-error')
    const run = step
      .split('        run: |\n')[1]!
      .split('\n')
      .filter((line) => line.startsWith('          '))
      .map((line) => line.slice(10))
      .join('\n')
    const root = mkdtempSync(join(tmpdir(), 'waveform-quality-gate-'))
    try {
      // Execute only the extracted local validation block. Never run a release workflow.
      const shim = join(root, 'pnpm')
      writeFileSync(shim, '#!/bin/sh\necho "$1"\n[ "$1" != "$FAIL_CHECK" ]\n')
      chmodSync(shim, 0o755)
      for (const [position, check] of checks.entries()) {
        const result = spawnSync('bash', ['-c', `${run}\necho PUBLISH_SENTINEL`], {
          cwd: root,
          env: { ...process.env, PATH: `${root}:${process.env.PATH}`, FAIL_CHECK: check },
          encoding: 'utf8',
        })
        expect(result.status).not.toBe(0)
        expect(result.stdout.trim().split('\n')).toEqual(checks.slice(0, position + 1))
        expect(result.stdout).not.toContain('PUBLISH_SENTINEL')
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { packageTestInput } from '../../scripts/package-test-input.mjs'

const roots: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'package-input-'))
  roots.push(root)
  return root
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))

describe('package consumer input', () => {
  it('does not run the imported verifier with the parent CLI arguments', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "process.argv[2] = '--tarball'; await import('./scripts/verify-unified-package.mjs')",
      ],
      { encoding: 'utf8' },
    )
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toBe('')
  })

  it('verifies the exact supplied tarball without packing or modifying it', () => {
    const root = fixture()
    const tarball = join(root, 'release.tgz')
    writeFileSync(tarball, 'verified bytes')
    const pack = vi.fn()
    expect(packageTestInput(['--tarball', tarball], root, pack)).toBe(tarball)
    expect(readFileSync(tarball, 'utf8')).toBe('verified bytes')
    expect(pack).not.toHaveBeenCalled()
  })

  it('rejects invalid explicit inputs instead of silently packing a replacement', () => {
    const root = fixture()
    const directory = join(root, 'directory.tgz')
    mkdirSync(directory)
    const pack = vi.fn()
    for (const args of [
      ['--tarball', join(root, 'missing.tgz')],
      ['--tarball', directory],
      ['--tarball', root],
      ['--tarball'],
      ['--unknown'],
    ]) {
      expect(() => packageTestInput(args, root, pack)).toThrow()
    }
    expect(pack).not.toHaveBeenCalled()
  })

  it('retains prepack for default local usage', () => {
    const root = fixture()
    const pack = vi.fn(() => writeFileSync(join(root, 'local.tgz'), 'local build'))
    expect(packageTestInput([], root, pack)).toBe(join(root, 'local.tgz'))
    expect(pack).toHaveBeenCalledWith(['pack', '--pack-destination', root])
  })

  it('propagates packing failures and rejects ambiguous output', () => {
    const root = fixture()
    expect(() =>
      packageTestInput([], root, () => {
        throw new Error('build failed')
      }),
    ).toThrow('build failed')
    expect(() => packageTestInput([], root, vi.fn())).toThrow('exactly one')
    writeFileSync(join(root, 'one.tgz'), '')
    writeFileSync(join(root, 'two.tgz'), '')
    expect(() => packageTestInput([], root, vi.fn())).toThrow('exactly one')
  })
})

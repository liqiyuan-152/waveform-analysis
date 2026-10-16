import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { packageManagerInvocation } from '../../scripts/package-manager.mjs'

const roots: string[] = []
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))

describe('development package manager invocation', () => {
  it.each(['pnpm.exe', 'pnpm', 'PNPM.EXE'])('launches native %s directly', (entry) => {
    expect(packageManagerInvocation(entry, ['prepare:demo'])).toEqual({
      command: entry,
      args: ['prepare:demo'],
    })
  })

  it.each(['js', 'cjs', 'mjs'])(
    'runs a %s entry with Node and preserves spaced arguments',
    (ext) => {
      const root = mkdtempSync(join(tmpdir(), 'waveform pnpm '))
      roots.push(root)
      const entry = join(root, `pnpm.${ext}`)
      writeFileSync(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))')
      const invocation = packageManagerInvocation(entry, ['prepare:demo', 'path with spaces'])
      const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual(['prepare:demo', 'path with spaces'])
    },
  )

  it('executes a native binary without passing it to Node as source', () => {
    const invocation = packageManagerInvocation(process.execPath, ['--version'])
    const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe(process.version)
  })
})

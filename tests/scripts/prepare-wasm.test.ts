import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareWasm } from '../../scripts/prepare-wasm.mjs'

const roots: string[] = []
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'waveform-wasm-'))
  roots.push(root)
  mkdirSync(join(root, 'wasm/src'), { recursive: true })
  for (const path of ['wasm/src/lib.rs', 'wasm/Cargo.toml', 'wasm/Cargo.lock'])
    writeFileSync(join(root, path), 'source')
  let version = '1'
  let fail = false
  const run = vi.fn((tool: string, args: string[]) => {
    if (args[0] !== 'build') return `${tool} ${version}`
    if (fail) throw new Error('build failed')
    mkdirSync(join(root, 'wasm/pkg'), { recursive: true })
    for (const file of [
      'waveform_sampling_wasm.js',
      'waveform_sampling_wasm.d.ts',
      'waveform_sampling_wasm_bg.wasm',
      'waveform_sampling_wasm_bg.wasm.d.ts',
      'package.json',
    ])
      writeFileSync(join(root, 'wasm/pkg', file), version)
    return ''
  })
  return {
    root,
    run: run as unknown as typeof execFileSync,
    setVersion: () => {
      version = '2'
    },
    setFailure: (value: boolean) => {
      fail = value
    },
  }
}
describe('WASM preparation', () => {
  it('prepares once and verifies artifacts across nested calls', () => {
    const f = fixture()
    expect(prepareWasm(f).built).toBe(true)
    expect(prepareWasm(f).built).toBe(false)
    expect(prepareWasm({ ...f, force: true }).built).toBe(true)
  })
  it('invalidates changed sources, tool versions, missing and modified outputs', () => {
    const f = fixture()
    prepareWasm(f)
    writeFileSync(join(f.root, 'wasm/src/lib.rs'), 'changed')
    expect(prepareWasm(f).built).toBe(true)
    f.setVersion()
    expect(prepareWasm(f).built).toBe(true)
    writeFileSync(join(f.root, 'wasm/pkg/waveform_sampling_wasm.js'), 'tampered')
    expect(prepareWasm(f).built).toBe(true)
    rmSync(join(f.root, 'wasm/pkg/waveform_sampling_wasm_bg.wasm'))
    expect(prepareWasm(f).built).toBe(true)
  })
  it('does not accept a failed preparation as current', () => {
    const f = fixture()
    f.setFailure(true)
    expect(() => prepareWasm(f)).toThrow('build failed')
    f.setFailure(false)
    expect(prepareWasm(f).built).toBe(true)
  })
})

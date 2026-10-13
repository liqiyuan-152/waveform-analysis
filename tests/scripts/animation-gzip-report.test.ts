import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { collectGzipSizes, compareGzipSizes } from '../../scripts/animation-gzip-report.mjs'

describe('animation gzip accounting', () => {
  it('counts renamed, removed and added chunks plus nested binary assets', () => {
    const before = new Map([
      ['index.js', 100],
      ['index.cjs', 110],
      ['style.css', 20],
      ['assets/worker-old.js', 40],
      ['assets/removed.js', 15],
    ])
    const after = new Map([
      ['index.js', 105],
      ['index.cjs', 115],
      ['style.css', 20],
      ['assets/worker-new.js', 40],
      ['chunks/animation.js', 30],
      ['assets/nested/model.wasm', 50],
    ])
    const report = compareGzipSizes(before, after)
    expect(report.additionalFiles).toContainEqual({
      file: 'assets/removed.js',
      beforeBytes: 15,
      afterBytes: 0,
      deltaBytes: -15,
    })
    expect(report.additionalFiles).toContainEqual({
      file: 'chunks/animation.js',
      beforeBytes: 0,
      afterBytes: 30,
      deltaBytes: 30,
    })
    expect(report.totals).toEqual([
      { file: 'index.js', beforeBytes: 175, afterBytes: 245, deltaBytes: 70 },
      { file: 'index.cjs', beforeBytes: 185, afterBytes: 255, deltaBytes: 70 },
    ])
  })
  it('reads every nested output using the same gzip settings as entry files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'animation-gzip-test-'))
    try {
      mkdirSync(join(directory, 'chunks', 'nested'), { recursive: true })
      const binary = Buffer.from([0, 1, 2, 255])
      writeFileSync(join(directory, 'index.js'), 'export const x = 1')
      writeFileSync(join(directory, 'chunks', 'nested', 'model.wasm'), binary)
      expect(collectGzipSizes(directory)).toEqual(
        new Map([
          ['chunks/nested/model.wasm', gzipSync(binary).length],
          ['index.js', gzipSync('export const x = 1').length],
        ]),
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
  it('rejects missing entry formats rather than treating a broken build as savings', () => {
    const files = new Map([
      ['index.js', 10],
      ['index.cjs', 12],
      ['style.css', 5],
    ])
    const missing = new Map(files)
    missing.delete('index.cjs')
    expect(() => compareGzipSizes(files, missing)).toThrow('Missing build entry: index.cjs')
  })
})

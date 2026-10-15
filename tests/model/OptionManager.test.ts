import { describe, expect, it } from 'vitest'
import { OptionManager } from '@/model/OptionManager'
import type { WaveformChartOptionUpdate } from '@/types/options'

describe('native configuration candidates', () => {
  it('replaces nested configuration, preserves untouched fields and caller references', () => {
    const data = Object.freeze({ kind: 'points' as const, points: [] })
    const manager = new OptionManager({ data, legend: { position: 'bottom', interactive: true } })
    const candidate = manager.prepare({ legend: { position: 'left' } })
    expect(manager.value.legend.interactive).toBe(true)
    manager.commit(candidate)
    expect(manager.value.legend).toEqual({ position: 'left' })
    expect(manager.value.data).toBe(data)
    const reset = manager.prepare({ legend: undefined, annotations: undefined })
    manager.commit(reset)
    expect(manager.value.legend).toEqual({ position: 'top-right', orientation: 'auto' })
    expect(manager.value.annotations).toEqual([])
  })

  it('rejects a mixed update without changing live configuration', () => {
    const manager = new OptionManager({ timeUnit: 'ms' })
    const before = manager.value
    expect(() =>
      manager.prepare({
        lineColor: 'red',
        timeUnit: 'bad',
      } as unknown as WaveformChartOptionUpdate),
    ).toThrow(expect.objectContaining({ code: 'invalid-option', field: 'timeUnit' }))
    expect(manager.value).toBe(before)
    expect(manager.value.lineColor).toBe('#0960bd')
    expect(() => manager.prepare({ data: undefined })).toThrow(
      expect.objectContaining({ code: 'invalid-option', field: 'data' }),
    )
  })

  it.each([
    null,
    { kind: 'unknown' },
    { kind: 'points', points: null },
    { kind: 'series', series: [{ name: 'a', data: null }] },
  ])('reports invalid data structures with a stable field: %j', (data) => {
    const manager = new OptionManager()
    expect(() => manager.prepare({ data } as unknown as WaveformChartOptionUpdate)).toThrow(
      expect.objectContaining({ code: 'invalid-option', field: 'data' }),
    )
  })

  it('preserves numeric data tolerance and rejects unsafe callable configuration', () => {
    const manager = new OptionManager({ data: { kind: 'samples', values: [NaN], sampleRate: -1 } })
    expect(manager.value.data.kind).toBe('samples')
    expect(() =>
      manager.prepare({
        axes: { x: { labelFormatter: 'bad' } },
      } as unknown as WaveformChartOptionUpdate),
    ).toThrow(expect.objectContaining({ code: 'invalid-option', field: 'axes' }))
  })

  it.each([
    { kind: 'typed-samples', values: new DataView(new ArrayBuffer(8)), sampleRate: 1 },
    { kind: 'typed-samples', values: new BigInt64Array(2), sampleRate: 1 },
    { kind: 'typed-samples', values: new Uint8Array(2), sampleRate: 1 },
    { kind: 'typed-points', x: new Float32Array(2), y: new Float64Array(2) },
    { kind: 'typed-points', x: new Float64Array(2), y: new DataView(new ArrayBuffer(8)) },
    { kind: 'typed-points', x: new Float64Array(2), y: new Float64Array(2), error: [] },
    { kind: 'samples', values: [], sampleRate: 1, startTime: 'bad' },
  ])('rejects unsupported numeric storage before preparation: case %#', (data) => {
    const manager = new OptionManager()
    expect(() => manager.prepare({ data } as unknown as WaveformChartOptionUpdate)).toThrow(
      expect.objectContaining({ code: 'invalid-option', field: 'data' }),
    )
  })

  it('accepts cross-realm floating storage and leaves numeric tolerance to normalization', () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    try {
      const owner = frame.contentWindow! as unknown as typeof globalThis
      const data = {
        kind: 'typed-points' as const,
        x: new owner.Float64Array([NaN, 1]),
        y: new owner.Float32Array([1]),
        error: new owner.Float32Array([Infinity]),
      }
      const manager = new OptionManager({ data })
      expect(manager.value.data).toBe(data)
    } finally {
      frame.remove()
    }
  })
})

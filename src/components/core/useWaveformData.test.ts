import { describe, expect, it } from 'vitest'

import { prepareWaveformSeries } from './useWaveformData'

describe('prepareWaveformSeries compact inputs', () => {
  it('keeps dense typed samples as numeric columns until individual points are requested', () => {
    const values = Float32Array.from({ length: 100_001 }, (_, index) => index / 10)
    const snapshot = values.slice()
    const [series] = prepareWaveformSeries({
      kind: 'typed-samples',
      values,
      sampleRate: 1_000,
      startTime: 2,
    })

    expect(series?.source.isCompact).toBe(true)
    expect(series?.points).toHaveLength(values.length)
    expect(series?.xDomain[0]).toBeLessThanOrEqual(2)
    expect(series?.xDomain[1]).toBeGreaterThanOrEqual(102)
    expect(series?.source.pointAt(50_000)).toEqual({ x: 52, y: 5_000 })
    expect(values).toEqual(snapshot)

    const workerDataset = series?.source.toWorkerDataset()
    expect(workerDataset).toMatchObject({
      kind: 'samples',
      sampleRate: 1_000,
      startTime: 2,
    })
    if (workerDataset?.kind === 'samples') {
      expect(workerDataset).not.toHaveProperty('sourceIndexes')
      expect(workerDataset.values.buffer).not.toBe(values.buffer)
      expect(workerDataset.values).toEqual(values)
    }
  })

  it('preserves invalid-sample time gaps without allocating an X column', () => {
    const [series] = prepareWaveformSeries({
      kind: 'typed-samples',
      values: new Float64Array([1, Number.NaN, 3]),
      sampleRate: 2,
      startTime: 10,
    })

    expect(series?.source.pointsInRange()).toEqual([
      { x: 10, y: 1 },
      { x: 11, y: 3 },
    ])
    expect(series?.source.toWorkerDataset()).toMatchObject({
      kind: 'samples',
      values: new Float64Array([1, 3]),
      sourceIndexes: new Uint32Array([0, 2]),
    })
  })

  it('filters and stably orders compact typed points without materializing source point objects', () => {
    const [series] = prepareWaveformSeries({
      kind: 'typed-points',
      x: new Float64Array([2, 1, 1, Number.NaN]),
      y: new Float32Array([20, 10, 11, 12]),
      error: new Float32Array([1, -1, Number.NaN, 4]),
    })

    expect(series?.source.isCompact).toBe(true)
    expect(series?.source.pointsInRange()).toEqual([
      { x: 1, y: 10 },
      { x: 1, y: 11 },
      { x: 2, y: 20, error: 1 },
    ])
    expect(series?.source.visibleRange([1, 1])).toEqual({ start: 0, end: 2 })
    expect(series?.source.nearestPoint(-10)).toEqual({ x: 1, y: 10 })
    expect(series?.source.nearestPoint(10)).toEqual({ x: 2, y: 20, error: 1 })
  })

  it('retains normal array access, iteration, slicing, mapping, and enumeration semantics', () => {
    const [series] = prepareWaveformSeries({
      kind: 'typed-samples',
      values: new Float32Array([2, 4, 6]),
      sampleRate: 2,
    })

    expect(series?.points[1]).toEqual({ x: 0.5, y: 4 })
    expect(series?.points.at(-1)).toEqual({ x: 1, y: 6 })
    expect([...(series?.points ?? [])]).toEqual([
      { x: 0, y: 2 },
      { x: 0.5, y: 4 },
      { x: 1, y: 6 },
    ])
    expect(series?.points.slice(1)).toEqual([
      { x: 0.5, y: 4 },
      { x: 1, y: 6 },
    ])
    expect(series?.points.map((point) => point.y)).toEqual([2, 4, 6])
    expect(Object.keys(series?.points ?? [])).toEqual(['0', '1', '2'])
  })
})

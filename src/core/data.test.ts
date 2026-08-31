import { describe, expect, it, vi } from 'vitest'

import { normalizeWaveformData, normalizeWaveformSeries } from './data'

describe('waveform data normalization', () => {
  it('builds sample points in one pass while preserving source indexes', () => {
    expect(
      normalizeWaveformData({
        kind: 'samples',
        values: [1, Number.NaN, 3],
        sampleRate: 2,
        startTime: 1,
      }),
    ).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 3 },
    ])
  })

  it('normalizes typed samples without mutating their values or buffer', () => {
    const values = new Float32Array([1, Number.NaN, 3])
    const snapshot = values.slice()

    expect(
      normalizeWaveformData({
        kind: 'typed-samples',
        values,
        sampleRate: 2,
        startTime: 1,
      }),
    ).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 3 },
    ])
    expect(values).toEqual(snapshot)
    expect(values.buffer.byteLength).toBe(snapshot.buffer.byteLength)
  })

  it('rejects malformed typed sample input without coercing numeric fields', () => {
    expect(
      normalizeWaveformData({
        kind: 'typed-samples',
        values: new Float64Array([1]),
        sampleRate: Number.POSITIVE_INFINITY,
      }),
    ).toEqual([])
    expect(
      normalizeWaveformData({
        kind: 'typed-samples',
        values: new Float64Array([1]),
        sampleRate: 1,
        startTime: Number.NaN,
      }),
    ).toEqual([])
    expect(
      normalizeWaveformData({
        kind: 'typed-samples',
        values: new Int32Array([1]),
        sampleRate: 1,
      } as unknown as Parameters<typeof normalizeWaveformData>[0]),
    ).toEqual([])
  })

  it('normalizes typed points, errors, and unordered coordinates without mutation', () => {
    const x = new Float64Array([2, 1, 1, Number.NaN])
    const y = new Float32Array([20, 10, 11, 12])
    const error = new Float64Array([1, -1, Number.NaN, 4])
    const lowerError = new Float32Array([2, 3, 4, 5])
    const upperError = new Float64Array([3, 4, 5, 6])
    const snapshots = [x.slice(), y.slice(), error.slice(), lowerError.slice(), upperError.slice()]

    expect(
      normalizeWaveformData({ kind: 'typed-points', x, y, error, lowerError, upperError }),
    ).toEqual([
      { x: 1, y: 10, lowerError: 3, upperError: 4 },
      { x: 1, y: 11, lowerError: 4, upperError: 5 },
      { x: 2, y: 20, error: 1, lowerError: 2, upperError: 3 },
    ])
    expect(x).toEqual(snapshots[0])
    expect(y).toEqual(snapshots[1])
    expect(error).toEqual(snapshots[2])
    expect(lowerError).toEqual(snapshots[3])
    expect(upperError).toEqual(snapshots[4])
  })

  it('rejects typed points with unsupported arrays or mismatched field lengths', () => {
    expect(
      normalizeWaveformData({
        kind: 'typed-points',
        x: new Float64Array([0, 1]),
        y: new Float32Array([1]),
      }),
    ).toEqual([])
    expect(
      normalizeWaveformData({
        kind: 'typed-points',
        x: new Float64Array([0]),
        y: new Float64Array([1]),
        upperError: new Float32Array([1, 2]),
      }),
    ).toEqual([])
    expect(
      normalizeWaveformData({
        kind: 'typed-points',
        x: new Float32Array([0]),
        y: new Float32Array([1]),
      } as unknown as Parameters<typeof normalizeWaveformData>[0]),
    ).toEqual([])
  })

  it('skips sorting already ordered points and normalizes errors', () => {
    const sortSpy = vi.spyOn(Array.prototype, 'sort')
    try {
      const result = normalizeWaveformData({
        kind: 'points',
        points: [
          { x: 0, y: 1, error: -1, upperError: 2 },
          { x: 1, y: 2, lowerError: 3 },
        ],
      })

      expect(sortSpy).not.toHaveBeenCalled()
      expect(result).toEqual([
        { x: 0, y: 1, upperError: 2 },
        { x: 1, y: 2, lowerError: 3 },
      ])
    } finally {
      sortSpy.mockRestore()
    }
  })

  it('sorts only unordered points and preserves duplicate-x order', () => {
    expect(
      normalizeWaveformData({
        kind: 'points',
        points: [
          { x: 2, y: 20 },
          { x: 1, y: 10 },
          { x: 1, y: 11 },
          { x: Number.NaN, y: 12 },
        ],
      }),
    ).toEqual([
      { x: 1, y: 10 },
      { x: 1, y: 11 },
      { x: 2, y: 20 },
    ])
  })

  it('preserves every valid point in large data sets', () => {
    const points = Array.from({ length: 10_001 }, (_, index) => ({
      x: index,
      y: index === 5_555 ? 1 : 0,
      ...(index === 5_555 ? { error: 10_000 } : {}),
    }))

    const result = normalizeWaveformData({ kind: 'points', points })

    expect(result).toHaveLength(points.length)
    expect(result[5_555]).toEqual({ x: 5_555, y: 1, error: 10_000 })
  })

  it('defaults and normalizes per-series line styles', () => {
    const data = {
      kind: 'series' as const,
      series: [
        { id: 'solid', name: 'Solid', data: { kind: 'points' as const, points: [{ x: 0, y: 1 }] } },
        {
          id: 'dashed',
          name: 'Dashed',
          lineStyle: 'dashed' as const,
          data: { kind: 'points' as const, points: [{ x: 0, y: 1 }] },
        },
        {
          id: 'dash-dot',
          name: 'Dash dot',
          lineStyle: 'dash-dot' as const,
          data: { kind: 'points' as const, points: [{ x: 0, y: 1 }] },
        },
        {
          id: 'invalid',
          name: 'Invalid',
          lineStyle: 'zigzag' as never,
          data: { kind: 'points' as const, points: [{ x: 0, y: 1 }] },
        },
      ],
    }

    expect(normalizeWaveformSeries(data).map((series) => series.lineStyle)).toEqual([
      'solid',
      'dashed',
      'dash-dot',
      'solid',
    ])
  })

  it('preserves trimmed shot numbers and omits blank values', () => {
    const result = normalizeWaveformSeries({
      kind: 'series',
      series: [
        {
          id: 'with-shot',
          shotNo: '  13300  ',
          name: '通道 A',
          data: { kind: 'points', points: [{ x: 0, y: 1 }] },
        },
        {
          id: 'without-shot',
          shotNo: '   ',
          name: '通道 B',
          data: { kind: 'points', points: [{ x: 0, y: 2 }] },
        },
      ],
    })

    expect(result.map((series) => series.shotNo)).toEqual(['13300', undefined])
  })

  it('accepts compact inputs inside regular series containers', () => {
    const result = normalizeWaveformSeries({
      kind: 'series',
      series: [
        {
          id: 'typed',
          name: 'Typed',
          data: {
            kind: 'typed-points',
            x: new Float64Array([0, 1]),
            y: new Float32Array([2, 3]),
          },
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.points).toEqual([
      { x: 0, y: 2 },
      { x: 1, y: 3 },
    ])
  })
})

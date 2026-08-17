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
})

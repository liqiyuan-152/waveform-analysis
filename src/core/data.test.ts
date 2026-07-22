import { describe, expect, it, vi } from 'vitest'

import { normalizeWaveformData } from './data'

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
})

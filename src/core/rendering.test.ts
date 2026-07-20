import { describe, expect, it } from 'vitest'

import type { WaveformPoint } from '../types'
import { resolveWaveformRenderingOptions, selectRenderablePoints } from './rendering'

describe('waveform rendering selection', () => {
  const points = Array.from({ length: 10_000 }, (_, index): WaveformPoint => ({
    x: index,
    y: index === 5_001 ? 10_000 : Math.sin(index / 20),
  }))

  it('clips to the visible domain and retains one continuity point on each side', () => {
    const selected = selectRenderablePoints(
      points,
      [4_000, 4_100],
      500,
      resolveWaveformRenderingOptions({ downsample: false }),
    )

    expect(selected[0].x).toBe(3_999)
    expect(selected.at(-1)?.x).toBe(4_101)
  })

  it('bounds path density while preserving narrow extrema', () => {
    const selected = selectRenderablePoints(
      points,
      [0, 9_999],
      100,
      resolveWaveformRenderingOptions({ downsampleThreshold: 100, maxPointsPerPixel: 4 }),
    )

    expect(selected.length).toBeLessThanOrEqual(402)
    expect(selected).toContain(points[5_001])
    expect(selected[0]).toBe(points[0])
    expect(selected.at(-1)).toBe(points.at(-1))
  })

  it('normalizes invalid rendering options to stable defaults', () => {
    expect(
      resolveWaveformRenderingOptions({ downsampleThreshold: -1, maxPointsPerPixel: 0 }),
    ).toEqual({ downsample: true, downsampleThreshold: 2_000, maxPointsPerPixel: 4 })
  })
})

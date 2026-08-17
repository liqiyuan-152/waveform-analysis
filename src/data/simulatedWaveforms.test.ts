import { describe, expect, it } from 'vitest'

import { createSimulatedWaveformData } from './simulatedWaveforms'

describe('simulated waveform data', () => {
  it('creates deterministic, finite six-channel data', () => {
    const first = createSimulatedWaveformData()
    const second = createSimulatedWaveformData()

    expect(first).toEqual(second)
    expect(first.kind).toBe('series')
    if (first.kind !== 'series') return

    expect(first.series).toHaveLength(6)
    expect(new Set(first.series.map((series) => series.id)).size).toBe(6)
    expect(new Set(first.series.map((series) => series.shotNo))).toEqual(new Set(['13300']))
    first.series.forEach((series) => {
      expect(series.data.kind).toBe('points')
      if (series.data.kind !== 'points') return
      expect(series.data.points).toHaveLength(1_000)
      expect(series.data.points[0]?.x).toBe(-5)
      expect(series.data.points.at(-1)?.x).toBe(5)
      series.data.points.forEach((point) => {
        expect(Number.isFinite(point.x)).toBe(true)
        expect(Number.isFinite(point.y)).toBe(true)
        if (point.error !== undefined) expect(point.error).toBeGreaterThanOrEqual(0)
        if (point.lowerError !== undefined) expect(point.lowerError).toBeGreaterThanOrEqual(0)
        if (point.upperError !== undefined) expect(point.upperError).toBeGreaterThanOrEqual(0)
      })
    })
  })
})

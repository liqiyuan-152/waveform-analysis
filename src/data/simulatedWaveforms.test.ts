import { describe, expect, it } from 'vitest'

import { createSimulatedWaveformData } from './simulatedWaveforms'

describe('simulated waveform data', () => {
  it('creates deterministic, finite eight-channel data with a three-series second frame', () => {
    const first = createSimulatedWaveformData()
    const second = createSimulatedWaveformData()

    expect(first).toEqual(second)
    expect(first.kind).toBe('series')
    if (first.kind !== 'series') return

    expect(first.series).toHaveLength(8)
    expect(new Set(first.series.map((series) => series.id)).size).toBe(8)
    const secondFrame = first.series.filter(
      (series) => series.trackId === 'simulated-harmonic-frame',
    )
    expect(secondFrame).toHaveLength(3)
    expect(new Set(first.series.map((series) => series.shotNo))).toEqual(new Set(['13300']))
    const firstSeries = first.series[0]
    expect(firstSeries).toMatchObject({
      id: 'simulated-sine',
      lineType: 'linear',
      pointType: 'circle',
      errorBar: { visible: true, width: 1.5, capWidth: 10 },
    })
    if (firstSeries?.data.kind === 'points') {
      const lowerErrors = firstSeries.data.points.map((point) => point.lowerError)
      const upperErrors = firstSeries.data.points.map((point) => point.upperError)
      expect(
        lowerErrors.every((error) => error !== undefined && error >= 0.05 && error < 0.5),
      ).toBe(true)
      expect(
        upperErrors.every((error) => error !== undefined && error >= 0.05 && error < 0.5),
      ).toBe(true)
      expect(new Set(lowerErrors).size).toBeGreaterThan(900)
      expect(new Set(upperErrors).size).toBeGreaterThan(900)
    }
    first.series.forEach((series) => {
      expect(series.data.kind).toBe('points')
      if (series.data.kind !== 'points') return
      if (series.id === 'simulated-step') {
        expect(series.data.points).toHaveLength(500)
        expect(series.data.points.every((point) => point.x >= 0)).toBe(true)
      } else {
        expect(series.data.points).toHaveLength(1_000)
        expect(series.data.points[0]?.x).toBe(-5)
      }
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

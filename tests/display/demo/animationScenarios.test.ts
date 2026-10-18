import { describe, expect, it } from 'vitest'
import { animationScenario } from '../../../demo-app/src/display/animation-scenarios'
import type { WaveformSeries } from 'waveform-analysis/display'

describe('Demo append scenario (OpenSpec 9.21)', () => {
  it('preserves all existing point IDs, coordinates, bindings and styles across counter wrap boundaries', () => {
    const original: WaveformSeries[] = [
      {
        id: 'a',
        name: 'A',
        yAxis: 'left',
        style: { lineWidth: 3 },
        data: [
          { id: 'a0', x: 0, y: 5 },
          { id: 'a1', x: 2, y: 7 },
        ],
      },
      {
        id: 'b',
        name: 'B',
        yAxis: 'right',
        data: [
          { id: 'b0', x: 10, y: -3 },
          { id: 'b1', x: 15, y: -2 },
        ],
      },
    ]
    const snapshot = structuredClone(original)
    let current = original
    for (let version = 1; version <= 31; version++) {
      const next = animationScenario('append', version, current)
      next.forEach((series, index) => {
        expect(series.id).toBe(original[index].id)
        expect(series.yAxis).toBe(original[index].yAxis)
        expect(series.style).toEqual(original[index].style)
        expect(series.data).toHaveLength(2 + version)
        expect(series.data.slice(0, -1)).toEqual(current[index].data)
        expect(series.data[series.data.length - 1].x).toBe(
          index ? 15 + version * 5 : 2 + version * 2,
        )
        expect(new Set(series.data.map((point) => point.id)).size).toBe(series.data.length)
      })
      current = next
    }
    expect(original).toEqual(snapshot)
  })

  it('appends to the actual previous scene and initializes empty points safely', () => {
    for (const scene of ['window', 'domain', 'extreme', 'auto-padding']) {
      const previous = animationScenario(scene, 9)
      const next = animationScenario('append', 10, previous)
      next.forEach((series, index) =>
        expect(series.data.slice(0, -1)).toEqual(previous[index].data),
      )
    }
    expect(animationScenario('append', 1, [{ id: 'empty', data: [] }])[0].data[0].x).toBe(0)
    expect(animationScenario('append', 1)).toEqual([])
    expect(animationScenario('append', 1, [])).toEqual([])
  })
})

describe('Demo animation scenario contracts (OpenSpec 9.22–9.25)', () => {
  it('slides the window by one X unit per version and removes only the old point', () => {
    const first = animationScenario('window', 3)
    const second = animationScenario('window', 4)
    first.forEach((series, index) => {
      expect(series.data.map((point) => point.x)).toEqual(
        Array.from({ length: 14 }, (_, offset) => 3 + offset),
      )
      expect(second[index].data.map((point) => point.x)).toEqual(
        Array.from({ length: 14 }, (_, offset) => 4 + offset),
      )
      expect(second[index].data.slice(0, -1).map((point) => point.x)).toEqual(
        first[index].data.slice(1).map((point) => point.x),
      )
      expect(second[index].data.some((point) => point.id === first[index].data[0].id)).toBe(false)
    })
  })

  it('keeps extreme displacement finite and varies automatic-padding amplitude without changing topology', () => {
    const extreme = animationScenario('extreme', 1)
    expect(extreme).toHaveLength(2)
    expect(
      extreme.flatMap((series) => series.data).every((point) => Number.isFinite(point.y)),
    ).toBe(true)
    const low = animationScenario('auto-padding', 1)
    const high = animationScenario('auto-padding', 4)
    expect(low.map((series) => series.data.length)).toEqual(
      high.map((series) => series.data.length),
    )
    expect(Math.max(...high[0].data.map((point) => Math.abs(point.y)))).toBeGreaterThan(
      Math.max(...low[0].data.map((point) => Math.abs(point.y))),
    )
  })
})

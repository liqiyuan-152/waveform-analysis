import { describe, expect, it } from 'vitest'
import { WaveformDataManager } from '@/data/WaveformDataManager'
import { WaveformQueryService } from '@/data/WaveformQueryService'
import type { WaveformData } from '@/types/data'

describe('native full-data preparation and queries', () => {
  it('prepares candidates without touching live sources and caches by immutable reference', () => {
    const manager = new WaveformDataManager()
    const first: WaveformData = { kind: 'points', points: [{ x: 0, y: 1 }] }
    const candidate = manager.prepare(first)
    expect(manager.series).toEqual([])
    manager.commit(candidate)
    expect(manager.revision).toBe(1)
    expect(manager.prepare(first)).toBe(candidate)
    expect(manager.commit(manager.prepare(first))).toBe(false)
    const next: WaveformData = { kind: 'points', points: [{ x: 2, y: 3 }] }
    const pending = manager.prepare(next)
    expect(manager.series[0]?.source.pointAt(0)).toEqual({ x: 0, y: 1 })
    manager.commit(pending)
    expect(manager.revision).toBe(2)
    expect(manager.series[0]?.source.pointAt(0)).toEqual({ x: 2, y: 3 })
    manager.dispose()
    expect(manager.series).toEqual([])
  })

  it('queries full compact data and error extrema without modifying source points', () => {
    const manager = new WaveformDataManager()
    manager.commit(
      manager.prepare({
        kind: 'typed-points',
        x: new Float64Array([0, 0.5, 1, 1.5, 2]),
        y: new Float32Array([0, 1, 99, -1, 0]),
        upperError: new Float32Array([0, 0, 5, 0, 0]),
      }),
    )
    const query = new WaveformQueryService(manager)
    expect(manager.series[0]?.source.isCompact).toBe(true)
    const point = query.nearestPoint('series-0', 1.01)!
    expect(point).toEqual({ x: 1, y: 99, upperError: 5 })
    point.y = 0
    expect(query.nearestPoint('series-0', 1)?.y).toBe(99)
    expect(query.pointsInDomain('series-0', [1.5, 0.5]).map((item) => item.x)).toEqual([
      0.5, 1, 1.5,
    ])
    expect(query.metrics('series-0', true)?.yMaximum).toBe(104)
    expect(query.nearestPoint('series-0', -1)).toBeUndefined()
    expect(query.nearestPoint('series-0', NaN)).toBeUndefined()
    expect(query.pointsInDomain('unknown', [0, 1])).toEqual([])
  })

  it('retains empty series only when requested and preserves normalization tolerance', () => {
    const manager = new WaveformDataManager()
    const data: WaveformData = {
      kind: 'series',
      series: [
        { id: 'a', name: 'empty', data: { kind: 'points', points: [] } },
        {
          id: 'a',
          name: 'unsorted',
          data: {
            kind: 'points',
            points: [
              { x: 1, y: 1 },
              { x: NaN, y: 2 },
              { x: 0, y: 3 },
            ],
          },
        },
      ],
    }
    manager.commit(manager.prepare(data))
    expect(manager.series.map((series) => series.id)).toEqual(['a-1'])
    manager.commit(manager.prepare(data, true))
    expect(manager.series.map((series) => series.id)).toEqual(['a', 'a-1'])
    expect(manager.series[1]?.source.pointsInRange()).toEqual([
      { x: 0, y: 3 },
      { x: 1, y: 1 },
    ])
  })
})

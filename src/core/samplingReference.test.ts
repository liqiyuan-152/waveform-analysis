import { describe, expect, it } from 'vitest'

import type { WaveformPoint } from '../types'
import {
  sampleWaveformReference,
  type ReferenceSamplingStrategy,
  type SourceIndexSamplingResult,
} from './samplingReference'
import {
  REFERENCE_AGGREGATE_VECTORS,
  REFERENCE_SAMPLING_POINTS,
  REFERENCE_SOURCE_INDEX_VECTORS,
} from './samplingReferenceVectors'

function indexes(strategy: Exclude<ReferenceSamplingStrategy, 'average' | 'sum'>, target: number) {
  const result = sampleWaveformReference({
    points: REFERENCE_SAMPLING_POINTS,
    strategy,
    targetPointCount: target,
  })
  expect(result.kind).toBe('source-indexes')
  return Array.from((result as SourceIndexSamplingResult).sourceIndexes)
}

describe('sampleWaveformReference', () => {
  it('locks the source-index strategy vectors', () => {
    for (const vector of REFERENCE_SOURCE_INDEX_VECTORS) {
      expect(indexes(vector.strategy, vector.targetPointCount)).toEqual(
        vector.expectedSourceIndexes,
      )
    }
  })

  it('locks the aggregate bucket and synthesized-X semantics', () => {
    for (const vector of REFERENCE_AGGREGATE_VECTORS) {
      const result = sampleWaveformReference({
        points: REFERENCE_SAMPLING_POINTS,
        strategy: vector.strategy,
        targetPointCount: vector.targetPointCount,
      })

      expect(result).toMatchObject({ kind: 'aggregates', validPointCount: 8 })
      expect(Array.from(result.kind === 'aggregates' ? result.x : [])).toEqual(vector.expectedX)
      expect(Array.from(result.kind === 'aggregates' ? result.y : [])).toEqual(vector.expectedY)
    }
  })

  it('uses the earliest point for equal extrema and removes duplicate peak entries', () => {
    const tied = [
      { x: 0, y: 0 },
      { x: 1, y: -5 },
      { x: 2, y: -5 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 0 },
      { x: 6, y: 0 },
    ]

    const minmax = sampleWaveformReference({
      points: tied,
      strategy: 'minmax',
      targetPointCount: 4,
    })
    const peak = sampleWaveformReference({ points: tied, strategy: 'peak', targetPointCount: 6 })

    expect(Array.from(minmax.kind === 'source-indexes' ? minmax.sourceIndexes : [])).toEqual([
      0, 1, 3, 6,
    ])
    expect(Array.from(peak.kind === 'source-indexes' ? peak.sourceIndexes : [])).toEqual([
      0, 1, 3, 5, 6,
    ])
  })

  it('filters invalid points, stably orders X, and returns indexes into the original input', () => {
    const input: WaveformPoint[] = [
      { x: 2, y: 20 },
      { x: Number.NaN, y: 99 },
      { x: 1, y: 10 },
      { x: 1, y: 11 },
      { x: 3, y: Number.POSITIVE_INFINITY },
    ]
    const result = sampleWaveformReference({ points: input, strategy: 'none', targetPointCount: 1 })

    expect(result).toMatchObject({ inputPointCount: 5, validPointCount: 3, kind: 'source-indexes' })
    expect(Array.from(result.kind === 'source-indexes' ? result.sourceIndexes : [])).toEqual([
      2, 3, 0,
    ])
    expect(input).toEqual([
      { x: 2, y: 20 },
      { x: Number.NaN, y: 99 },
      { x: 1, y: 10 },
      { x: 1, y: 11 },
      { x: 3, y: Number.POSITIVE_INFINITY },
    ])
  })

  it('defines empty, short, and low-target behavior without exceeding the target', () => {
    const strategies: ReferenceSamplingStrategy[] = [
      'none',
      'peak',
      'lttb',
      'average',
      'min',
      'max',
      'minmax',
      'sum',
    ]
    for (const strategy of strategies) {
      const empty = sampleWaveformReference({ points: [], strategy, targetPointCount: 3 })
      expect(empty.kind === 'aggregates' ? empty.x : empty.sourceIndexes).toHaveLength(0)

      const short = sampleWaveformReference({
        points: REFERENCE_SAMPLING_POINTS.slice(0, 2),
        strategy,
        targetPointCount: 10,
      })
      expect(short.kind === 'aggregates' ? short.x : short.sourceIndexes).toHaveLength(2)
    }

    expect(indexes('lttb', 2)).toEqual([0, 7])
    expect(indexes('minmax', 3)).toEqual([0, 7])
    expect(indexes('peak', 6)).toHaveLength(5)
  })
})

import { describe, expect, it } from 'vitest'

import type { WaveformPoint } from '@/types'
import { sampleWaveformReference } from '../samplingReference'
import { MultiResolutionSamplingIndex } from './multiresolution'

const points: WaveformPoint[] = Array.from({ length: 65 }, (_, index) => ({
  x: index,
  y: index === 1 ? -90 : index === 31 ? 120 : Math.sin(index / 3) * 10 + index / 9,
}))

function outputPoints(result: ReturnType<MultiResolutionSamplingIndex['sample']>) {
  if (!result || result.kind !== 'source-indexes') return []
  return [...result.sourceIndexes]
}

describe('MultiResolutionSamplingIndex', () => {
  it('matches reference source indexes for unaligned viewport boundaries', () => {
    const index = new MultiResolutionSamplingIndex(points)
    const visible = points.slice(3, 61)

    for (const strategy of ['peak', 'min', 'max', 'minmax'] as const) {
      const expected = sampleWaveformReference({
        points: visible,
        strategy,
        targetPointCount: 17,
      })
      expect(expected.kind).toBe('source-indexes')
      if (expected.kind !== 'source-indexes') continue
      expect(outputPoints(index.sample(3, 61, strategy, 17))).toEqual(
        [...expected.sourceIndexes].map((sourceIndex) => sourceIndex + 3),
      )
    }
    expect(index.byteLength).toBeGreaterThan(0)
  })

  it('uses reusable sum and count layers for average and sum buckets', () => {
    const index = new MultiResolutionSamplingIndex(points)
    for (const strategy of ['average', 'sum'] as const) {
      const expected = sampleWaveformReference({
        points: points.slice(5, 62),
        strategy,
        targetPointCount: 13,
      })
      const actual = index.sample(5, 62, strategy, 13)
      expect(expected.kind).toBe('aggregates')
      expect(actual).toMatchObject({ kind: 'aggregates' })
      if (expected.kind !== 'aggregates' || actual?.kind !== 'aggregates') continue
      actual.x.forEach((value, index) => expect(value).toBeCloseTo(expected.x[index]!, 12))
      actual.y.forEach((value, index) => expect(value).toBeCloseTo(expected.y[index]!, 12))
    }
  })

  it('falls back when its bounded index memory cannot serve a query and releases all layers', () => {
    const index = new MultiResolutionSamplingIndex(points, { maxBytes: 8 })

    expect(index.sample(0, points.length, 'peak', 8)).toBeUndefined()
    expect(index.byteLength).toBe(0)
    index.dispose()
    expect(index.byteLength).toBe(0)
  })

  it('leaves LTTB as a viewport-local calculation', () => {
    const index = new MultiResolutionSamplingIndex(points)

    expect(index.sample(5, 62, 'lttb', 13)).toBeUndefined()
    expect(index.byteLength).toBe(0)
  })
})

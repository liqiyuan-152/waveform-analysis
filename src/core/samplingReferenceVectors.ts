import type { WaveformPoint } from '../types'
import type { ReferenceSamplingStrategy } from './samplingReference'

/** Stable source data shared by the TypeScript reference and future WASM conformance suites. */
export const REFERENCE_SAMPLING_POINTS: readonly WaveformPoint[] = [
  { x: 0, y: 4 },
  { x: 1, y: 1 },
  { x: 2, y: 8 },
  { x: 3, y: 2 },
  { x: 4, y: 7 },
  { x: 5, y: 0 },
  { x: 6, y: 9 },
  { x: 7, y: 3 },
]

export interface SourceIndexSamplingVector {
  strategy: Exclude<ReferenceSamplingStrategy, 'average' | 'sum'>
  targetPointCount: number
  expectedSourceIndexes: readonly number[]
}

export const REFERENCE_SOURCE_INDEX_VECTORS: readonly SourceIndexSamplingVector[] = [
  { strategy: 'none', targetPointCount: 3, expectedSourceIndexes: [0, 1, 2, 3, 4, 5, 6, 7] },
  { strategy: 'peak', targetPointCount: 6, expectedSourceIndexes: [0, 1, 5, 6, 7] },
  { strategy: 'min', targetPointCount: 6, expectedSourceIndexes: [0, 1, 3, 4, 5, 7] },
  { strategy: 'max', targetPointCount: 6, expectedSourceIndexes: [0, 1, 2, 4, 6, 7] },
  { strategy: 'minmax', targetPointCount: 6, expectedSourceIndexes: [0, 1, 2, 5, 6, 7] },
  { strategy: 'lttb', targetPointCount: 5, expectedSourceIndexes: [0, 2, 3, 6, 7] },
]

export interface AggregateSamplingVector {
  strategy: Extract<ReferenceSamplingStrategy, 'average' | 'sum'>
  targetPointCount: number
  expectedX: readonly number[]
  expectedY: readonly number[]
}

export const REFERENCE_AGGREGATE_VECTORS: readonly AggregateSamplingVector[] = [
  {
    strategy: 'average',
    targetPointCount: 3,
    expectedX: [0.5, 3, 6],
    expectedY: [2.5, 17 / 3, 4],
  },
  { strategy: 'sum', targetPointCount: 3, expectedX: [0.5, 3, 6], expectedY: [5, 17, 12] },
]

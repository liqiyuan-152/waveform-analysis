import type { WaveformPoint } from '../types'

/** Sampling algorithms that can be implemented equivalently by the future WASM core. */
export type ReferenceSamplingStrategy =
  'none' | 'peak' | 'lttb' | 'average' | 'min' | 'max' | 'minmax' | 'sum'

/**
 * A pure TypeScript reference request. Source indexes in the result address the original
 * `points` array, after filtering non-finite points and applying a stable ascending-X order.
 */
export interface ReferenceSamplingRequest {
  points: readonly WaveformPoint[]
  strategy: ReferenceSamplingStrategy
  targetPointCount: number
}

interface ReferenceSamplingResultBase {
  strategy: ReferenceSamplingStrategy
  inputPointCount: number
  validPointCount: number
}

/** A result made of real points from the input sequence. */
export interface SourceIndexSamplingResult extends ReferenceSamplingResultBase {
  kind: 'source-indexes'
  sourceIndexes: Uint32Array
}

/** A result whose points are synthesized from a contiguous source bucket. */
export interface AggregateSamplingResult extends ReferenceSamplingResultBase {
  kind: 'aggregates'
  x: Float64Array
  y: Float64Array
}

export type ReferenceSamplingResult = SourceIndexSamplingResult | AggregateSamplingResult

interface IndexedPoint {
  sourceIndex: number
  x: number
  y: number
}

function normalizedPoints(points: readonly WaveformPoint[]): IndexedPoint[] {
  const result: IndexedPoint[] = []
  let ordered = true
  let previousX = Number.NEGATIVE_INFINITY

  for (let sourceIndex = 0; sourceIndex < points.length; sourceIndex += 1) {
    const point = points[sourceIndex]
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    if (point.x < previousX) ordered = false
    previousX = point.x
    result.push({ sourceIndex, x: point.x, y: point.y })
  }

  // ES2019 guarantees stable Array#sort, preserving duplicate-X source order.
  if (!ordered) result.sort((left, right) => left.x - right.x)
  return result
}

function targetCount(value: number, pointCount: number) {
  if (pointCount === 0) return 0
  if (!Number.isFinite(value)) return pointCount
  return Math.min(pointCount, Math.max(1, Math.floor(value)))
}

function bucketBounds(bucket: number, bucketCount: number, start: number, end: number) {
  const span = end - start
  return {
    start: start + Math.floor((bucket * span) / bucketCount),
    end: start + Math.floor(((bucket + 1) * span) / bucketCount),
  }
}

function addUniqueIndex(indexes: number[], index: number) {
  if (indexes[indexes.length - 1] !== index) indexes.push(index)
}

function withEndpoints(points: IndexedPoint[], target: number, selectInterior: () => number[]) {
  if (points.length <= target) return points.map((_, index) => index)
  if (target === 1) return [0]
  if (target === 2) return [0, points.length - 1]

  const indexes = [0]
  for (const index of selectInterior()) addUniqueIndex(indexes, index)
  addUniqueIndex(indexes, points.length - 1)
  return indexes
}

function selectExtrema(points: IndexedPoint[], target: number, kind: 'min' | 'max' | 'minmax') {
  const bucketCount = kind === 'minmax' ? Math.floor((target - 2) / 2) : Math.max(0, target - 2)

  return withEndpoints(points, target, () => {
    if (bucketCount === 0) return []
    const result: number[] = []
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const bounds = bucketBounds(bucket, bucketCount, 1, points.length - 1)
      let minimum = bounds.start
      let maximum = bounds.start
      for (let index = bounds.start + 1; index < bounds.end; index += 1) {
        if (points[index]!.y < points[minimum]!.y) minimum = index
        if (points[index]!.y > points[maximum]!.y) maximum = index
      }
      if (kind === 'min') {
        addUniqueIndex(result, minimum)
      } else if (kind === 'max') {
        addUniqueIndex(result, maximum)
      } else if (minimum <= maximum) {
        addUniqueIndex(result, minimum)
        addUniqueIndex(result, maximum)
      } else {
        addUniqueIndex(result, maximum)
        addUniqueIndex(result, minimum)
      }
    }
    return result
  })
}

function selectPeak(points: IndexedPoint[], target: number) {
  const bucketCount = Math.floor((target - 2) / 4)
  return withEndpoints(points, target, () => {
    if (bucketCount === 0) return []
    const result: number[] = []
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const bounds = bucketBounds(bucket, bucketCount, 1, points.length - 1)
      let minimum = bounds.start
      let maximum = bounds.start
      for (let index = bounds.start + 1; index < bounds.end; index += 1) {
        if (points[index]!.y < points[minimum]!.y) minimum = index
        if (points[index]!.y > points[maximum]!.y) maximum = index
      }
      for (const index of [bounds.start, minimum, maximum, bounds.end - 1].sort((a, b) => a - b)) {
        addUniqueIndex(result, index)
      }
    }
    return result
  })
}

function selectLttb(points: IndexedPoint[], target: number) {
  return withEndpoints(points, target, () => {
    const bucketSize = (points.length - 2) / (target - 2)
    const result: number[] = []
    let previous = 0

    for (let bucket = 0; bucket < target - 2; bucket += 1) {
      const averageStart = Math.min(points.length, Math.floor((bucket + 1) * bucketSize) + 1)
      const averageEnd = Math.min(points.length, Math.floor((bucket + 2) * bucketSize) + 1)
      let averageX = 0
      let averageY = 0
      for (let index = averageStart; index < averageEnd; index += 1) {
        averageX += points[index]!.x
        averageY += points[index]!.y
      }
      const averageCount = averageEnd - averageStart
      if (averageCount > 0) {
        averageX /= averageCount
        averageY /= averageCount
      } else {
        averageX = points[points.length - 1]!.x
        averageY = points[points.length - 1]!.y
      }

      const bounds = bucketBounds(bucket, target - 2, 1, points.length - 1)
      let selected = bounds.start
      let maximumArea = -1
      for (let index = bounds.start; index < bounds.end; index += 1) {
        const area = Math.abs(
          (points[previous]!.x - averageX) * (points[index]!.y - points[previous]!.y) -
            (points[previous]!.x - points[index]!.x) * (averageY - points[previous]!.y),
        )
        if (area > maximumArea) {
          maximumArea = area
          selected = index
        }
      }
      result.push(selected)
      previous = selected
    }
    return result
  })
}

function aggregate(points: IndexedPoint[], target: number, strategy: 'average' | 'sum') {
  const count = targetCount(target, points.length)
  const x = new Float64Array(count)
  const y = new Float64Array(count)
  for (let bucket = 0; bucket < count; bucket += 1) {
    const bounds = bucketBounds(bucket, count, 0, points.length)
    for (let index = bounds.start; index < bounds.end; index += 1) {
      x[bucket] += points[index]!.x
      y[bucket] += points[index]!.y
    }
    const bucketSize = bounds.end - bounds.start
    x[bucket] /= bucketSize
    if (strategy === 'average') y[bucket] /= bucketSize
  }
  return { x, y }
}

/**
 * Samples an immutable point sequence without changing its objects or order. Aggregate X values
 * are the arithmetic mean of each contiguous bucket's X values; extrema ties select the earliest
 * source point. Source-point strategies preserve first and last points whenever the target is 2+.
 */
export function sampleWaveformReference(
  request: ReferenceSamplingRequest,
): ReferenceSamplingResult {
  const points = normalizedPoints(request.points)
  const base = {
    strategy: request.strategy,
    inputPointCount: request.points.length,
    validPointCount: points.length,
  }

  if (request.strategy === 'average' || request.strategy === 'sum') {
    return {
      ...base,
      kind: 'aggregates',
      ...aggregate(points, request.targetPointCount, request.strategy),
    }
  }

  const target = targetCount(request.targetPointCount, points.length)
  let indexes: number[]
  if (request.strategy === 'none' || points.length <= target) {
    indexes = points.map((_, index) => index)
  } else if (request.strategy === 'peak') {
    indexes = selectPeak(points, target)
  } else if (request.strategy === 'lttb') {
    indexes = selectLttb(points, target)
  } else {
    indexes = selectExtrema(points, target, request.strategy)
  }

  return {
    ...base,
    kind: 'source-indexes',
    sourceIndexes: Uint32Array.from(indexes, (index) => points[index]!.sourceIndex),
  }
}

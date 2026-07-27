import { bisector } from 'd3'

import type { WaveformPoint } from '@/types'
import { resolveWaveformPointErrors } from './data'
import type { ResolvedWaveformRenderingOptions } from './renderingOptions'

export {
  DEFAULT_WAVEFORM_RENDERING_OPTIONS,
  resolveWaveformRenderingOptions,
  type ResolvedWaveformRenderingOptions,
} from './renderingOptions'

const pointBisector = bisector((point: WaveformPoint) => point.x)
const acceptAllPoints = () => true

interface VisiblePointRange {
  start: number
  end: number
}

interface PointSeriesSource {
  points: WaveformPoint[]
}

interface SeriesRenderSelectionOptions {
  lineVisible: boolean
  pointVisible: boolean
  errorBarVisible: boolean
  hasErrorPoints: boolean
}

export interface SeriesRenderPointSelection {
  linePoints: WaveformPoint[]
  pointRenderPoints: WaveformPoint[]
  errorBarRenderPoints: WaveformPoint[]
}

export function resolveVisiblePointRange(
  points: WaveformPoint[],
  domain: [number, number],
): VisiblePointRange {
  const domainStart = Math.min(domain[0], domain[1])
  const domainEnd = Math.max(domain[0], domain[1])
  return {
    start: pointBisector.left(points, domainStart),
    end: pointBisector.right(points, domainEnd),
  }
}

export function hasMinimumVisibleXValues(
  seriesList: readonly PointSeriesSource[],
  domain: [number, number],
  minimum: number,
): boolean {
  if (!Number.isFinite(minimum) || minimum <= 0) return true
  const required = Math.ceil(minimum)
  const xValues = new Set<number>()
  for (const series of seriesList) {
    const range = resolveVisiblePointRange(series.points, domain)
    for (let index = range.start; index < range.end; index += 1) {
      xValues.add(series.points[index].x)
      if (xValues.size >= required) return true
    }
  }
  return false
}

function pushUniquePoint(target: WaveformPoint[], point: WaveformPoint | undefined) {
  if (point && target[target.length - 1] !== point) target.push(point)
}

function selectRenderablePointsInRange(
  points: WaveformPoint[],
  range: VisiblePointRange,
  domain: [number, number],
  width: number,
  options: ResolvedWaveformRenderingOptions,
): WaveformPoint[] {
  const domainStart = Math.min(domain[0], domain[1])
  const domainEnd = Math.max(domain[0], domain[1])
  const start = Math.max(0, range.start - 1)
  const end = Math.min(points.length, range.end + 1)
  const visibleCount = end - start
  if (visibleCount <= 0) return []
  if (!options.downsample || visibleCount <= options.downsampleThreshold) {
    return points.slice(start, end)
  }

  const maximumPointCount = Math.max(4, Math.floor(width * options.maxPointsPerPixel))
  const bucketCount = Math.max(1, Math.floor(maximumPointCount / 4))
  if (visibleCount <= maximumPointCount) return points.slice(start, end)

  const result: WaveformPoint[] = []
  const span = domainEnd - domainStart || 1
  const bucketIndexes = Array.from({ length: 4 }, () => -1)
  let activeBucket = -1
  let firstIndex = -1
  let lastIndex = -1
  let minimumIndex = -1
  let maximumIndex = -1

  const addBucketIndex = (index: number, count: number) => {
    if (index < 0) return count
    for (let position = 0; position < count; position += 1) {
      if (bucketIndexes[position] === index) return count
    }
    bucketIndexes[count] = index
    return count + 1
  }

  const flushBucket = () => {
    if (firstIndex < 0) return
    let count = 0
    count = addBucketIndex(firstIndex, count)
    count = addBucketIndex(minimumIndex, count)
    count = addBucketIndex(maximumIndex, count)
    count = addBucketIndex(lastIndex, count)
    for (let index = 1; index < count; index += 1) {
      const value = bucketIndexes[index]
      let position = index - 1
      while (position >= 0 && bucketIndexes[position] > value) {
        bucketIndexes[position + 1] = bucketIndexes[position]
        position -= 1
      }
      bucketIndexes[position + 1] = value
    }
    for (let index = 0; index < count; index += 1) {
      pushUniquePoint(result, points[bucketIndexes[index]])
    }
  }

  pushUniquePoint(result, points[start])
  for (let index = range.start; index < range.end; index += 1) {
    const point = points[index]
    const bucket = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor(((point.x - domainStart) / span) * bucketCount)),
    )
    if (bucket !== activeBucket) {
      flushBucket()
      activeBucket = bucket
      firstIndex = index
      lastIndex = index
      minimumIndex = index
      maximumIndex = index
      continue
    }
    lastIndex = index
    if (point.y < points[minimumIndex].y) minimumIndex = index
    if (point.y > points[maximumIndex].y) maximumIndex = index
  }
  flushBucket()
  pushUniquePoint(result, points[end - 1])
  return result
}

/**
 * Select the visible source range and preserve first/min/max/last values in each X bucket.
 * Source points must be sorted by X.
 */
export function selectRenderablePoints(
  points: WaveformPoint[],
  domain: [number, number],
  width: number,
  options: ResolvedWaveformRenderingOptions,
): WaveformPoint[] {
  if (!points.length || width <= 0) return []
  return selectRenderablePointsInRange(
    points,
    resolveVisiblePointRange(points, domain),
    domain,
    width,
    options,
  )
}

function selectDecorationPointsInRange(
  points: WaveformPoint[],
  range: VisiblePointRange,
  domain: [number, number],
  width: number,
  minSpacing: number,
  downsample: boolean,
  predicate: (point: WaveformPoint) => boolean,
  priorityPredicate?: (point: WaveformPoint) => boolean,
): WaveformPoint[] {
  if (!downsample || minSpacing === 0) {
    if (predicate === acceptAllPoints) return points.slice(range.start, range.end)
    const visiblePoints: WaveformPoint[] = []
    for (let index = range.start; index < range.end; index += 1) {
      if (predicate(points[index])) visiblePoints.push(points[index])
    }
    return visiblePoints
  }

  const domainStart = Math.min(domain[0], domain[1])
  const domainEnd = Math.max(domain[0], domain[1])
  const span = domainEnd - domainStart
  if (span <= 0) {
    for (let index = range.start; index < range.end; index += 1) {
      if (predicate(points[index])) return [points[index]]
    }
    return []
  }

  const bucketCount = Math.max(1, Math.ceil(width / minSpacing))
  const bucketWidth = width / bucketCount
  let bucketPoints: Array<WaveformPoint | undefined> | undefined
  let bucketDistances: number[] | undefined
  let priorityBucketPoints: Array<WaveformPoint | undefined> | undefined
  let priorityBucketDistances: number[] | undefined
  const sparsePoints: WaveformPoint[] = []
  let alreadySparse = true
  let first: WaveformPoint | undefined
  let last: WaveformPoint | undefined
  let previousPixel = Number.NEGATIVE_INFINITY
  let candidateCount = 0

  const recordBucketPoint = (point: WaveformPoint, pixel: number) => {
    if (!bucketPoints || !bucketDistances || !priorityBucketPoints || !priorityBucketDistances) {
      return
    }
    const bucket = Math.min(bucketCount - 1, Math.floor(pixel / bucketWidth))
    const center = (bucket + 0.5) * bucketWidth
    const distance = Math.abs(pixel - center)
    if (distance < bucketDistances[bucket]) {
      bucketPoints[bucket] = point
      bucketDistances[bucket] = distance
    }
    if (priorityPredicate?.(point) && distance < priorityBucketDistances[bucket]) {
      priorityBucketPoints[bucket] = point
      priorityBucketDistances[bucket] = distance
    }
  }

  const initializeBuckets = () => {
    bucketPoints = Array.from({ length: bucketCount })
    bucketDistances = Array.from({ length: bucketCount }, () => Number.POSITIVE_INFINITY)
    priorityBucketPoints = Array.from({ length: bucketCount })
    priorityBucketDistances = Array.from({ length: bucketCount }, () => Number.POSITIVE_INFINITY)
    for (const point of sparsePoints) {
      const pixel = Math.max(0, Math.min(width, ((point.x - domainStart) / span) * width))
      recordBucketPoint(point, pixel)
    }
  }

  for (let index = range.start; index < range.end; index += 1) {
    const point = points[index]
    if (!predicate(point)) continue
    first ??= point
    last = point
    candidateCount += 1
    const pixel = Math.max(0, Math.min(width, ((point.x - domainStart) / span) * width))
    if (alreadySparse) {
      if (pixel - previousPixel < minSpacing) {
        alreadySparse = false
        initializeBuckets()
        sparsePoints.length = 0
      } else {
        sparsePoints.push(point)
        previousPixel = pixel
      }
    }
    if (!alreadySparse) recordBucketPoint(point, pixel)
  }
  if (candidateCount <= 2) {
    if (!first) return []
    return last && last !== first ? [first, last] : [first]
  }
  if (alreadySparse) return sparsePoints

  const selected = (bucketPoints ?? [])
    .map((point, index) => priorityBucketPoints?.[index] ?? point)
    .filter((point): point is WaveformPoint => point !== undefined)
  if (first && selected[0] !== first) selected.unshift(first)
  if (last && selected.at(-1) !== last) selected.push(last)
  return selected
}

/** Selects real source points for discrete decorations without using line-extrema sampling. */
export function selectDecorationPoints(
  points: WaveformPoint[],
  domain: [number, number],
  width: number,
  minSpacing: number,
  downsample: boolean,
  predicate: (point: WaveformPoint) => boolean = acceptAllPoints,
  priorityPredicate?: (point: WaveformPoint) => boolean,
): WaveformPoint[] {
  if (!points.length || width <= 0) return []
  return selectDecorationPointsInRange(
    points,
    resolveVisiblePointRange(points, domain),
    domain,
    width,
    minSpacing,
    downsample,
    predicate,
    priorityPredicate,
  )
}

function hasPointError(point: WaveformPoint): boolean {
  const { lower, upper } = resolveWaveformPointErrors(point)
  return lower !== 0 || upper !== 0
}

export function selectSeriesRenderPoints(
  points: WaveformPoint[],
  domain: [number, number],
  width: number,
  rendering: ResolvedWaveformRenderingOptions,
  selection: SeriesRenderSelectionOptions,
): SeriesRenderPointSelection {
  if (!points.length || width <= 0) {
    return { linePoints: [], pointRenderPoints: [], errorBarRenderPoints: [] }
  }
  const range = resolveVisiblePointRange(points, domain)
  const linePoints = selection.lineVisible
    ? selectRenderablePointsInRange(points, range, domain, width, rendering)
    : []
  const errorBarVisible = selection.errorBarVisible && selection.hasErrorPoints
  if (selection.pointVisible && errorBarVisible) {
    const sharedPoints = selectDecorationPointsInRange(
      points,
      range,
      domain,
      width,
      Math.max(rendering.pointMinSpacing, rendering.errorBarMinSpacing),
      rendering.downsample,
      acceptAllPoints,
      hasPointError,
    )
    return {
      linePoints,
      pointRenderPoints: sharedPoints,
      errorBarRenderPoints: sharedPoints.filter(hasPointError),
    }
  }
  return {
    linePoints,
    pointRenderPoints: selection.pointVisible
      ? selectDecorationPointsInRange(
          points,
          range,
          domain,
          width,
          rendering.pointMinSpacing,
          rendering.downsample,
          acceptAllPoints,
        )
      : [],
    errorBarRenderPoints: errorBarVisible
      ? selectDecorationPointsInRange(
          points,
          range,
          domain,
          width,
          rendering.errorBarMinSpacing,
          rendering.downsample,
          hasPointError,
        )
      : [],
  }
}

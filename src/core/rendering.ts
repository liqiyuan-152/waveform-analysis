import { bisector } from 'd3'

import type { WaveformPoint, WaveformRenderingOptions } from '@/types'

export interface ResolvedWaveformRenderingOptions {
  downsample: boolean
  downsampleThreshold: number
  maxPointsPerPixel: number
  pointMinSpacing: number
  errorBarMinSpacing: number
}

export const DEFAULT_WAVEFORM_RENDERING_OPTIONS: ResolvedWaveformRenderingOptions = {
  downsample: true,
  downsampleThreshold: 2_000,
  maxPointsPerPixel: 4,
  pointMinSpacing: 10,
  errorBarMinSpacing: 12,
}

const pointBisector = bisector((point: WaveformPoint) => point.x)

export function resolveWaveformRenderingOptions(
  options?: WaveformRenderingOptions,
): ResolvedWaveformRenderingOptions {
  const threshold = Number(options?.downsampleThreshold)
  const pointsPerPixel = Number(options?.maxPointsPerPixel)
  const pointMinSpacing = Number(options?.pointMinSpacing)
  const errorBarMinSpacing = Number(options?.errorBarMinSpacing)
  return {
    downsample: options?.downsample ?? DEFAULT_WAVEFORM_RENDERING_OPTIONS.downsample,
    downsampleThreshold:
      Number.isFinite(threshold) && threshold >= 2
        ? Math.floor(threshold)
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.downsampleThreshold,
    maxPointsPerPixel:
      Number.isFinite(pointsPerPixel) && pointsPerPixel > 0
        ? pointsPerPixel
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.maxPointsPerPixel,
    pointMinSpacing:
      Number.isFinite(pointMinSpacing) && pointMinSpacing >= 0
        ? pointMinSpacing
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.pointMinSpacing,
    errorBarMinSpacing:
      Number.isFinite(errorBarMinSpacing) && errorBarMinSpacing >= 0
        ? errorBarMinSpacing
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.errorBarMinSpacing,
  }
}

function pushUniquePoint(target: WaveformPoint[], point: WaveformPoint | undefined) {
  if (point && target[target.length - 1] !== point) target.push(point)
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

  const domainStart = Math.min(domain[0], domain[1])
  const domainEnd = Math.max(domain[0], domain[1])
  const visibleStart = pointBisector.left(points, domainStart)
  const visibleEnd = pointBisector.right(points, domainEnd)
  const start = Math.max(0, visibleStart - 1)
  const end = Math.min(points.length, visibleEnd + 1)
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
  let activeBucket = -1
  let firstIndex = -1
  let lastIndex = -1
  let minimumIndex = -1
  let maximumIndex = -1

  const flushBucket = () => {
    if (firstIndex < 0) return
    const indexes = [firstIndex, minimumIndex, maximumIndex, lastIndex]
      .filter((index, position, source) => index >= 0 && source.indexOf(index) === position)
      .sort((left, right) => left - right)
    indexes.forEach((index) => pushUniquePoint(result, points[index]))
  }

  pushUniquePoint(result, points[start])
  for (let index = Math.max(start, visibleStart); index < Math.min(end, visibleEnd); index += 1) {
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

/** Selects real source points for discrete decorations without using line-extrema sampling. */
export function selectDecorationPoints(
  points: WaveformPoint[],
  domain: [number, number],
  width: number,
  minSpacing: number,
  downsample: boolean,
  predicate: (point: WaveformPoint) => boolean = () => true,
  priorityPredicate?: (point: WaveformPoint) => boolean,
): WaveformPoint[] {
  if (!points.length || width <= 0) return []

  const domainStart = Math.min(domain[0], domain[1])
  const domainEnd = Math.max(domain[0], domain[1])
  const visibleStart = pointBisector.left(points, domainStart)
  const visibleEnd = pointBisector.right(points, domainEnd)
  if (!downsample || minSpacing === 0) {
    return points.slice(visibleStart, visibleEnd).filter(predicate)
  }

  const span = domainEnd - domainStart
  if (span <= 0) {
    const point = points.slice(visibleStart, visibleEnd).find(predicate)
    return point ? [point] : []
  }

  const toPixel = (point: WaveformPoint) => ((point.x - domainStart) / span) * width
  const sparsePoints: WaveformPoint[] = []
  let alreadySparse = true
  let first: WaveformPoint | undefined
  let last: WaveformPoint | undefined
  let previousPixel = Number.NEGATIVE_INFINITY
  let candidateCount = 0

  for (let index = visibleStart; index < visibleEnd; index += 1) {
    const point = points[index]
    if (!predicate(point)) continue
    first ??= point
    last = point
    candidateCount += 1
    if (!alreadySparse) continue
    const pixel = toPixel(point)
    if (pixel - previousPixel < minSpacing) {
      alreadySparse = false
      sparsePoints.length = 0
      continue
    }
    sparsePoints.push(point)
    previousPixel = pixel
  }
  if (candidateCount <= 2) {
    if (!first) return []
    return last && last !== first ? [first, last] : [first]
  }
  if (alreadySparse) return sparsePoints

  const bucketCount = Math.max(1, Math.ceil(width / minSpacing))
  const bucketWidth = width / bucketCount
  const bucketPoints: Array<WaveformPoint | undefined> = Array.from({ length: bucketCount })
  const bucketDistances = Array.from({ length: bucketCount }, () => Number.POSITIVE_INFINITY)
  const priorityBucketPoints: Array<WaveformPoint | undefined> = Array.from({
    length: bucketCount,
  })
  const priorityBucketDistances = Array.from(
    { length: bucketCount },
    () => Number.POSITIVE_INFINITY,
  )

  for (let index = visibleStart; index < visibleEnd; index += 1) {
    const point = points[index]
    if (!predicate(point)) continue
    const pixel = Math.max(0, Math.min(width, toPixel(point)))
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

  const selected = bucketPoints
    .map((point, index) => priorityBucketPoints[index] ?? point)
    .filter((point): point is WaveformPoint => point !== undefined)
  if (first && selected[0] !== first) selected.unshift(first)
  if (last && selected.at(-1) !== last) selected.push(last)
  return selected
}

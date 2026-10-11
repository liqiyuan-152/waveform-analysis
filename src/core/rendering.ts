import { pointSourceFromPoints, type WaveformPointSource } from './waveformPointSource'
import { withLineBoundaries } from './lineBoundary'
import { bisector } from 'd3'

import type { WaveformPoint } from '../types'
import { resolveWaveformPointErrors } from './data'
import type { ResolvedWaveformRenderingOptions } from './renderingOptions'
import {
  resolveRenderablePointSelectionStrategy,
  type VisiblePointRange,
} from './renderingStrategies'

export {
  DEFAULT_WAVEFORM_RENDERING_OPTIONS,
  resolveWaveformRenderingOptions,
  type ResolvedWaveformRenderingOptions,
  type ResolvedWaveformSamplingOptions,
} from './renderingOptions'

const pointBisector = bisector((point: WaveformPoint) => point.x)
const acceptAllPoints = () => true

interface PointSeriesSource {
  points: WaveformPoint[]
  source?: WaveformPointSource
}

interface SeriesRenderSelectionOptions {
  lineVisible: boolean
  /** A current Worker result used only for the SVG line. */
  linePointOverride?: WaveformPoint[]
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
    const source = series.source ?? pointSourceFromPoints(series.points)
    const range = source.visibleRange(domain)
    for (let index = range.start; index < range.end; index += 1) {
      xValues.add(source.pointAt(index)!.x)
      if (xValues.size >= required) return true
    }
  }
  return false
}

function selectRenderablePointsInRange(
  points: WaveformPointSource,
  range: VisiblePointRange,
  domain: [number, number],
  width: number,
  options: ResolvedWaveformRenderingOptions,
): WaveformPoint[] {
  if (range.start === range.end && (range.start === 0 || range.end === points.length)) return []
  const start = Math.max(0, range.start - 1)
  const end = Math.min(points.length, range.end + 1)
  const visibleCount = end - start
  if (visibleCount <= 0) return []
  return resolveRenderablePointSelectionStrategy({ visibleCount, width, options })({
    points: [],
    source: points,
    range,
    domain,
    width,
    options,
  })
}

function shouldDeferLineSampling(
  visibleCount: number,
  options: ResolvedWaveformRenderingOptions,
): boolean {
  if (options.sampling.mode === 'wasm') return true
  return options.sampling.mode === 'auto' && visibleCount > options.sampling.autoThreshold
}

function selectSamplingPlaceholderPoints(
  points: WaveformPointSource,
  range: VisiblePointRange,
  width: number,
  options: ResolvedWaveformRenderingOptions,
): WaveformPoint[] {
  const { start, end } = range
  const count = end - start
  const target =
    options.sampling.maxPointCount ??
    Math.max(1, Math.floor(width * options.sampling.maxPointsPerPixel))
  const interior =
    count <= target || options.sampling.strategy === 'none'
      ? points.pointsInRange(start, end)
      : Array.from({ length: target }, (_, index) =>
          points.pointAt(
            start + (target === 1 ? 0 : Math.round((index * (count - 1)) / (target - 1))),
          )!,
        )
  return withLineBoundaries(interior, range, points.length, (index) => points.pointAt(index)!)
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
    pointSourceFromPoints(points),
    resolveVisiblePointRange(points, domain),
    domain,
    width,
    options,
  )
}

function selectDecorationPointsInRange(
  points: WaveformPointSource,
  range: VisiblePointRange,
  domain: [number, number],
  width: number,
  minSpacing: number,
  downsample: boolean,
  predicate: (point: WaveformPoint) => boolean,
  priorityPredicate?: (point: WaveformPoint) => boolean,
): WaveformPoint[] {
  if (!downsample || minSpacing === 0) {
    if (predicate === acceptAllPoints) return points.pointsInRange(range.start, range.end)
    const visiblePoints: WaveformPoint[] = []
    for (let index = range.start; index < range.end; index += 1) {
      if (predicate(points.pointAt(index)!)) visiblePoints.push(points.pointAt(index)!)
    }
    return visiblePoints
  }

  const domainStart = Math.min(domain[0], domain[1])
  const domainEnd = Math.max(domain[0], domain[1])
  const span = domainEnd - domainStart
  if (span <= 0) {
    for (let index = range.start; index < range.end; index += 1) {
      if (predicate(points.pointAt(index)!)) return [points.pointAt(index)!]
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
    const point = points.pointAt(index)!
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
    pointSourceFromPoints(points),
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

export function selectSeriesRenderSourcePoints(
  points: WaveformPointSource,
  domain: [number, number],
  width: number,
  rendering: ResolvedWaveformRenderingOptions,
  selection: SeriesRenderSelectionOptions,
): SeriesRenderPointSelection {
  if (!points.length || width <= 0) {
    return { linePoints: [], pointRenderPoints: [], errorBarRenderPoints: [] }
  }
  const range = points.visibleRange(domain)
  const linePoints = selection.lineVisible
    ? (selection.linePointOverride ??
      (shouldDeferLineSampling(range.end - range.start, rendering)
        ? selectSamplingPlaceholderPoints(points, range, width, rendering)
        : selectRenderablePointsInRange(points, range, domain, width, rendering)))
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

/** Public array adapter; internal layout passes its normalized source directly. */
export function selectSeriesRenderPoints(
  points: WaveformPoint[],
  domain: [number, number],
  width: number,
  rendering: ResolvedWaveformRenderingOptions,
  selection: SeriesRenderSelectionOptions,
): SeriesRenderPointSelection {
  return selectSeriesRenderSourcePoints(
    pointSourceFromPoints(points),
    domain,
    width,
    rendering,
    selection,
  )
}

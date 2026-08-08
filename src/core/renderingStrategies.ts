import type { WaveformPoint } from '../types'
import type { ResolvedWaveformRenderingOptions } from './renderingOptions'

export interface VisiblePointRange {
  start: number
  end: number
}

export interface RenderablePointSelectionContext {
  points: WaveformPoint[]
  range: VisiblePointRange
  domain: [number, number]
  width: number
  options: ResolvedWaveformRenderingOptions
}

export type RenderablePointSelectionStrategy = (
  context: RenderablePointSelectionContext,
) => WaveformPoint[]

function selectionBounds(range: VisiblePointRange, pointCount: number) {
  return {
    start: Math.max(0, range.start - 1),
    end: Math.min(pointCount, range.end + 1),
  }
}

function pushUniquePoint(target: WaveformPoint[], point: WaveformPoint | undefined) {
  if (point && target[target.length - 1] !== point) target.push(point)
}

export const completePointSelectionStrategy: RenderablePointSelectionStrategy = (context) => {
  const { start, end } = selectionBounds(context.range, context.points.length)
  return context.points.slice(start, end)
}

export const peakPreservingPointSelectionStrategy: RenderablePointSelectionStrategy = (context) => {
  const { points, range, domain, width, options } = context
  const { start, end } = selectionBounds(range, points.length)
  const visibleCount = end - start
  if (visibleCount <= 0) return []

  const domainStart = Math.min(domain[0], domain[1])
  const domainEnd = Math.max(domain[0], domain[1])
  const maximumPointCount = Math.max(4, Math.floor(width * options.maxPointsPerPixel))
  const bucketCount = Math.max(1, Math.floor(maximumPointCount / 4))
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

export interface RenderablePointSelectionStrategyRequest {
  visibleCount: number
  width: number
  options: ResolvedWaveformRenderingOptions
}

export function resolveRenderablePointSelectionStrategy(
  request: RenderablePointSelectionStrategyRequest,
): RenderablePointSelectionStrategy {
  const maximumPointCount = Math.max(
    4,
    Math.floor(request.width * request.options.maxPointsPerPixel),
  )
  const shouldUseCompletePoints =
    !request.options.downsample ||
    request.visibleCount <= request.options.downsampleThreshold ||
    request.visibleCount <= maximumPointCount
  return shouldUseCompletePoints
    ? completePointSelectionStrategy
    : peakPreservingPointSelectionStrategy
}

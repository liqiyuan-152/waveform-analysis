import { bisector } from 'd3'

import type { WaveformPoint } from '@/types'
import {
  DEFAULT_WORKER_SAMPLING_AUTO_THRESHOLD,
  DEFAULT_WORKER_SAMPLING_MAX_POINTS_PER_PIXEL,
  type WorkerSamplingBackendKind,
  type WorkerSamplingDatasetMetrics,
  type WorkerSamplingDiagnostics,
  type WorkerSamplingOutput,
  type WorkerSamplingSeriesRequest,
  type WorkerSamplingStatus,
} from './protocol'

const pointBisector = bisector<WaveformPoint, number>((point) => point.x)

export function copyFinitePoints(points: readonly WaveformPoint[]) {
  const copied: WaveformPoint[] = []
  let sorted = true
  let previousX = Number.NEGATIVE_INFINITY
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    if (point.x < previousX) sorted = false
    previousX = point.x
    copied.push({
      x: point.x,
      y: point.y,
      ...(Number.isFinite(point.error) ? { error: point.error } : {}),
      ...(Number.isFinite(point.lowerError) ? { lowerError: point.lowerError } : {}),
      ...(Number.isFinite(point.upperError) ? { upperError: point.upperError } : {}),
    })
  }
  if (!sorted) copied.sort((left, right) => left.x - right.x)
  return copied
}

export function metricsFor(
  points: readonly WaveformPoint[],
  inputPointCount: number,
): WorkerSamplingDatasetMetrics {
  let xMinimum = Number.POSITIVE_INFINITY
  let xMaximum = Number.NEGATIVE_INFINITY
  let yMinimum = Number.POSITIVE_INFINITY
  let yMaximum = Number.NEGATIVE_INFINITY
  for (const point of points) {
    xMinimum = Math.min(xMinimum, point.x)
    xMaximum = Math.max(xMaximum, point.x)
    yMinimum = Math.min(yMinimum, point.y)
    yMaximum = Math.max(yMaximum, point.y)
  }
  return {
    inputPointCount,
    validPointCount: points.length,
    xDomain: points.length ? [xMinimum, xMaximum] : null,
    yDomain: points.length ? [yMinimum, yMaximum] : null,
  }
}

export function metricsForValues(
  x: Float64Array,
  y: Float32Array | Float64Array,
  inputPointCount = x.length,
): WorkerSamplingDatasetMetrics {
  let xMinimum = Number.POSITIVE_INFINITY
  let xMaximum = Number.NEGATIVE_INFINITY
  let yMinimum = Number.POSITIVE_INFINITY
  let yMaximum = Number.NEGATIVE_INFINITY
  for (let index = 0; index < x.length; index += 1) {
    xMinimum = Math.min(xMinimum, x[index]!)
    xMaximum = Math.max(xMaximum, x[index]!)
    yMinimum = Math.min(yMinimum, y[index]!)
    yMaximum = Math.max(yMaximum, y[index]!)
  }
  return {
    inputPointCount,
    validPointCount: x.length,
    xDomain: x.length ? [xMinimum, xMaximum] : null,
    yDomain: x.length ? [yMinimum, yMaximum] : null,
  }
}

export function statusFor<T extends { revision: number }>(
  dataset: T | undefined,
  revision: number,
): WorkerSamplingStatus {
  if (!dataset) return 'not-found'
  return dataset.revision === revision ? 'ok' : 'stale-revision'
}

export function selectedStrategy(strategy: WorkerSamplingSeriesRequest['strategy']) {
  return strategy === 'auto' ? 'peak' : strategy
}

export function targetPointCount(request: WorkerSamplingSeriesRequest) {
  const width = Number.isFinite(request.plotWidth) ? Math.max(0, request.plotWidth) : 0
  const density = Number.isFinite(request.maxPointsPerPixel)
    ? Math.max(0, request.maxPointsPerPixel ?? 0)
    : DEFAULT_WORKER_SAMPLING_MAX_POINTS_PER_PIXEL
  return Math.max(1, Math.floor(width * density))
}

export function shouldUseRaw(request: WorkerSamplingSeriesRequest, visiblePointCount: number) {
  if (request.mode === 'raw') return true
  if (request.mode !== 'auto') return false
  const threshold = Number.isFinite(request.autoThreshold)
    ? Math.max(1, Math.floor(request.autoThreshold ?? 0))
    : DEFAULT_WORKER_SAMPLING_AUTO_THRESHOLD
  if (!request.previousSelectedMode) return visiblePointCount <= threshold
  const hysteresis = Number.isFinite(request.autoHysteresis)
    ? Math.max(0, Math.floor(request.autoHysteresis ?? 0))
    : 0
  return request.previousSelectedMode === 'raw'
    ? visiblePointCount <= threshold + hysteresis
    : visiblePointCount <= Math.max(0, threshold - hysteresis)
}

export function visibleRange(points: readonly WaveformPoint[], domain: [number, number]) {
  const startX = Math.min(domain[0], domain[1])
  const endX = Math.max(domain[0], domain[1])
  return { start: pointBisector.left(points, startX), end: pointBisector.right(points, endX) }
}

export function visibleValueRange(x: Float64Array, domain: [number, number]) {
  const startX = Math.min(domain[0], domain[1])
  const endX = Math.max(domain[0], domain[1])
  let start = 0
  let end = x.length
  while (start < end) {
    const middle = start + Math.floor((end - start) / 2)
    if (x[middle]! < startX) start = middle + 1
    else end = middle
  }
  const rangeStart = start
  end = x.length
  while (start < end) {
    const middle = start + Math.floor((end - start) / 2)
    if (x[middle]! <= endX) start = middle + 1
    else end = middle
  }
  return { start: rangeStart, end: start }
}

export function nearestPoint(points: readonly WaveformPoint[], x: number) {
  const first = points[0]
  const last = points.at(-1)
  return Number.isFinite(x) && first && last && x >= first.x && x <= last.x
    ? points[pointBisector.center(points, x)]
    : undefined
}

export function outputCount(output: WorkerSamplingOutput | undefined) {
  if (!output) return 0
  return output.kind === 'source-indexes' ? output.sourceIndexes.length : output.x.length
}

export function outputWithGlobalIndexes(
  output: WorkerSamplingOutput,
  offset: number,
): WorkerSamplingOutput {
  if (output.kind === 'aggregates') return output
  return {
    kind: 'source-indexes',
    sourceIndexes: Uint32Array.from(output.sourceIndexes, (index) => index + offset),
  }
}

export function cacheKey(
  request: WorkerSamplingSeriesRequest,
  range: { start: number; end: number },
  strategy: ReturnType<typeof selectedStrategy>,
  target: number,
  backend: WorkerSamplingBackendKind,
) {
  return [
    request.datasetId,
    request.revision,
    range.start,
    range.end,
    request.plotWidth,
    target,
    request.maxPointsPerPixel,
    request.mode,
    backend,
    strategy,
    request.lineType ?? 'linear',
    request.pointType ?? 'none',
    request.errorBarVisible === true ? 1 : 0,
    request.pointMinSpacing ?? 0,
    request.errorBarMinSpacing ?? 0,
  ].join('\u0000')
}

export function diagnosticsFor(
  request: WorkerSamplingSeriesRequest,
  sourcePointCount: number,
  visiblePointCount: number,
  backend: WorkerSamplingBackendKind,
  selectedMode: 'raw' | 'sampled',
  durationMs: number,
  renderedPointCount: number,
  cacheHit: boolean,
): WorkerSamplingDiagnostics {
  return {
    seriesId: request.seriesId,
    datasetId: request.datasetId,
    mode: request.mode,
    selectedMode,
    backend,
    strategy: selectedStrategy(request.strategy),
    sourcePointCount,
    visiblePointCount,
    renderedPointCount,
    durationMs,
    cacheHit,
    requestId: 0,
    revision: request.revision,
    rawPointLimitExceeded:
      selectedMode === 'raw' &&
      Number.isFinite(request.rawPointLimit) &&
      visiblePointCount > (request.rawPointLimit ?? Number.POSITIVE_INFINITY),
    scheduledRequestCount: 0,
    coalescedRequestCount: 0,
    maxPendingRequestCount: 0,
  }
}

import { lineBoundaryIndexes } from '../core/lineBoundary'
import type {
  SampleViewportResponse,
  WorkerSamplingDiagnostics,
  WorkerSamplingSeriesRequest,
} from '../core/workerSampling'
import type { WaveformPoint, WaveformSamplingError } from '../types/chart'
import { pointSourceFromPoints, type WaveformPointSource } from '../core/waveformPointSource'
import type { DisplaySeries, TrackLayout } from '../components/core/types'
import type { ResolvedWaveformRenderingOptions } from '../core/renderingOptions'

export interface SamplingTarget {
  series: DisplaySeries
  source: WaveformPointSource
  request: WorkerSamplingSeriesRequest
  visibleRange: { start: number; end: number }
}

export function sourcePoints(
  result: SampleViewportResponse['results'][number],
  source: WaveformPointSource,
) {
  const output = result.output
  if (!output) return undefined
  if (output.kind === 'aggregates') {
    return Array.from(output.x, (x, index) => ({ x, y: output.y[index]! }))
  }
  return Array.from(output.sourceIndexes, (index) => source.pointAt(index)).filter(
    (point): point is WaveformPoint => point !== undefined,
  )
}

export function rawDiagnostics(
  target: SamplingTarget,
  requestId: number,
): WorkerSamplingDiagnostics {
  const sampling = target.request
  const visiblePointCount = target.visibleRange.end - target.visibleRange.start
  return {
    seriesId: sampling.seriesId,
    datasetId: sampling.datasetId,
    mode: sampling.mode,
    selectedMode: 'raw',
    backend: 'raw',
    strategy: sampling.strategy === 'auto' ? 'peak' : sampling.strategy,
    sourcePointCount: target.source.length,
    visiblePointCount,
    renderedPointCount:
      visiblePointCount + lineBoundaryIndexes(target.visibleRange, target.source.length).length,
    durationMs: 0,
    cacheHit: false,
    requestId,
    revision: sampling.revision,
    rawPointLimitExceeded:
      visiblePointCount > target.request.rawPointLimit! && target.request.mode === 'raw',
    scheduledRequestCount: 0,
    coalescedRequestCount: 0,
    maxPendingRequestCount: 0,
  }
}

export function fallbackInteriorPoints(target: SamplingTarget) {
  const { source } = target
  const { start, end } = target.visibleRange
  const count = end - start
  const targetCount =
    Number.isFinite(target.request.maxPointCount) && (target.request.maxPointCount ?? 0) >= 1
      ? Math.floor(target.request.maxPointCount as number)
      : Math.max(1, Math.floor(target.request.plotWidth * target.request.maxPointsPerPixel!))
  if (count <= targetCount) return source.pointsInRange(start, end)
  if (targetCount === 1) return source.pointAt(start) ? [source.pointAt(start)!] : []
  const points: WaveformPoint[] = []
  for (let index = 0; index < targetCount; index += 1) {
    const offset = Math.round((index * (count - 1)) / (targetCount - 1))
    const point = source.pointAt(start + offset)
    if (point) points.push(point)
  }
  return points
}

export function errorPayload(
  message: string,
  mode: WaveformSamplingError['mode'],
  fallback: WaveformSamplingError['fallback'],
  seriesIds: string[],
): WaveformSamplingError {
  return { message, mode, fallback, seriesIds }
}

export function buildSamplingTargets(
  instanceId: string,
  tracks: readonly TrackLayout[],
  rendering: ResolvedWaveformRenderingOptions,
  revisions: ReadonlyMap<string, number>,
  datasetIds?: ReadonlyMap<string, string>,
) {
  const sampling = rendering.sampling
  return tracks.flatMap((track) => {
    const domain = track.xScale.domain() as [number, number]
    return track.seriesList.flatMap((series) => {
      if (series.lineType === 'none' || track.width <= 0) return []
      const source = series.source ?? pointSourceFromPoints(series.points)
      const range = source.visibleRange(domain)
      const datasetId = datasetIds?.get(series.id) ?? `${instanceId}:${series.id}`
      return [
        {
          series,
          source,
          visibleRange: range,
          request: {
            seriesId: series.id,
            datasetId,
            revision: revisions.get(datasetId) ?? 1,
            xDomain: domain,
            visibleStartIndex: range.start,
            visibleEndIndex: range.end,
            plotWidth: track.width,
            mode: sampling.mode,
            autoThreshold: sampling.autoThreshold,
            autoHysteresis: sampling.autoHysteresis,
            strategy: sampling.strategy,
            maxPointsPerPixel: sampling.maxPointsPerPixel,
            maxPointCount: sampling.maxPointCount,
            rawPointLimit: sampling.rawPointLimit,
            wasmFailureFallback: sampling.wasmFailureFallback,
            lineType: series.lineType,
            pointType: series.pointType,
            errorBarVisible: series.errorBar.visible,
            pointMinSpacing: rendering.pointMinSpacing,
            errorBarMinSpacing: rendering.errorBarMinSpacing,
          },
        } satisfies SamplingTarget,
      ]
    })
  })
}

export function samplingSignature(targets: SamplingTarget[], epoch: number) {
  return `${epoch}:${targets
    .map(
      (target) =>
        `${target.request.datasetId}:${target.request.xDomain.join(',')}:${target.request.plotWidth}:${target.visibleRange.start}:${target.visibleRange.end}:${target.request.mode}:${target.request.autoThreshold}:${target.request.autoHysteresis}:${target.request.strategy}:${target.request.maxPointsPerPixel}:${target.request.maxPointCount}:${target.request.rawPointLimit}:${target.request.wasmFailureFallback}:${target.request.lineType}:${target.request.pointType}:${target.request.errorBarVisible}:${target.request.pointMinSpacing}:${target.request.errorBarMinSpacing}`,
    )
    .join('|')}`
}

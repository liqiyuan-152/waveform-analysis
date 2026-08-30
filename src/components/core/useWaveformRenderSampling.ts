import { computed, onScopeDispose, shallowRef, watch, type ComputedRef, type ShallowRef } from 'vue'

import {
  type SampleViewportResponse,
  type WorkerSamplingDiagnostics,
  type WorkerSamplingSeriesRequest,
} from '../../core/workerSampling'
import type { WaveformPoint, WaveformSamplingError } from '../../types'
import type { ResolvedWaveformRenderingOptions } from '../../core'
import { pointSourceFromPoints, type WaveformPointSource } from '../../core/waveformPointSource'
import type { PreparedWaveformSeries } from './useWaveformData'
import type { DisplaySeries, TrackLayout } from './types'
import type { ResolvedWaveformChartProps, WaveformChartEmit } from './waveformChartTypes'
import { createLatestTaskScheduler, resolveAutoSelectedMode } from './latestTaskScheduler'
import {
  createWorkerSamplingClient,
  isDatasetResponse,
  type WorkerSamplingClient,
} from './workerSamplingClient'

interface SamplingTarget {
  series: DisplaySeries
  source: WaveformPointSource
  request: WorkerSamplingSeriesRequest
  visibleRange: { start: number; end: number }
}
interface SamplingContext {
  props: ResolvedWaveformChartProps
  emit: WaveformChartEmit
  instanceId: string
  preparedSeries: ShallowRef<PreparedWaveformSeries[]>
  sourceTrackLayouts: ComputedRef<TrackLayout[]>
  renderingOptions: ComputedRef<ResolvedWaveformRenderingOptions>
  linePointOverrides: ShallowRef<Record<string, WaveformPoint[]>>
}

const AUTO_MODE_SETTLE_DELAY_MS = 120

function sourcePoints(
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

function rawDiagnostics(target: SamplingTarget, requestId: number): WorkerSamplingDiagnostics {
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
    renderedPointCount: visiblePointCount,
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

function fallbackPoints(target: SamplingTarget, maxPointsPerPixel: number) {
  const { source } = target
  const { start, end } = target.visibleRange
  const count = end - start
  const targetCount = Math.max(1, Math.floor(target.request.plotWidth * maxPointsPerPixel))
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

function errorPayload(
  message: string,
  mode: WaveformSamplingError['mode'],
  fallback: WaveformSamplingError['fallback'],
  seriesIds: string[],
): WaveformSamplingError {
  return { message, mode, fallback, seriesIds }
}

export function useWaveformRenderSampling(context: SamplingContext) {
  const dataEpoch = shallowRef(0)
  let client: WorkerSamplingClient | undefined
  let requestId = 0
  const revisions = new Map<string, number>()
  const backendBySeries = new Map<string, WorkerSamplingDiagnostics['backend']>()
  const selectedModeBySeries = new Map<string, 'raw' | 'sampled'>()
  const emittedErrors = new Set<string>()
  const pendingDiagnostics = new Map<string, WorkerSamplingDiagnostics>()
  const samplingScheduler = createLatestTaskScheduler()
  let diagnosticsTimer: ReturnType<typeof setTimeout> | undefined
  let autoModeSettleTimer: ReturnType<typeof setTimeout> | undefined
  let hasInitialSamplingRun = false

  const targets = computed(() => {
    const sampling = context.renderingOptions.value.sampling
    return context.sourceTrackLayouts.value.flatMap((track) => {
      const domain = track.xScale.domain() as [number, number]
      return track.seriesList.flatMap((series) => {
        if (series.lineType === 'none' || track.width <= 0) return []
        const source = series.source ?? pointSourceFromPoints(series.points)
        const range = source.visibleRange(domain)
        const datasetId = `${context.instanceId}:${series.id}`
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
              rawPointLimit: sampling.rawPointLimit,
              wasmFailureFallback: sampling.wasmFailureFallback,
              lineType: series.lineType,
              pointType: series.pointType,
              errorBarVisible: series.errorBar.visible,
              pointMinSpacing: context.renderingOptions.value.pointMinSpacing,
              errorBarMinSpacing: context.renderingOptions.value.errorBarMinSpacing,
            },
          } satisfies SamplingTarget,
        ]
      })
    })
  })
  const targetSignature = computed(
    () =>
      `${dataEpoch.value}:${targets.value
        .map(
          (target) =>
            `${target.request.datasetId}:${target.request.xDomain.join(',')}:${target.request.plotWidth}:${target.visibleRange.start}:${target.visibleRange.end}:${target.request.mode}:${target.request.autoThreshold}:${target.request.autoHysteresis}:${target.request.strategy}:${target.request.maxPointsPerPixel}:${target.request.rawPointLimit}:${target.request.wasmFailureFallback}:${target.request.lineType}:${target.request.pointType}:${target.request.errorBarVisible}:${target.request.pointMinSpacing}:${target.request.errorBarMinSpacing}`,
        )
        .join('|')}`,
  )

  const flushDiagnostics = () => {
    diagnosticsTimer = undefined
    pendingDiagnostics.forEach((diagnostic) => {
      const previousBackend = backendBySeries.get(diagnostic.seriesId)
      if (previousBackend && previousBackend !== diagnostic.backend) {
        context.emit('sampling-backend-change', {
          seriesId: diagnostic.seriesId,
          previous: previousBackend,
          current: diagnostic.backend,
        })
      }
      backendBySeries.set(diagnostic.seriesId, diagnostic.backend)
      context.emit('sampling-complete', diagnostic)
    })
    pendingDiagnostics.clear()
  }
  const emitDiagnostics = (diagnostics: WorkerSamplingDiagnostics[]) => {
    diagnostics.forEach((diagnostic) =>
      pendingDiagnostics.set(diagnostic.seriesId, {
        ...diagnostic,
        scheduledRequestCount: samplingScheduler.metrics.scheduled,
        coalescedRequestCount: samplingScheduler.metrics.coalesced,
        maxPendingRequestCount: samplingScheduler.metrics.maxPending,
      }),
    )
    if (!diagnosticsTimer) diagnosticsTimer = setTimeout(flushDiagnostics, 100)
  }

  const emitErrorOnce = (payload: WaveformSamplingError) => {
    const key = `${payload.mode}:${payload.fallback}:${payload.message}:${payload.seriesIds.join(',')}`
    if (emittedErrors.has(key)) return
    emittedErrors.add(key)
    context.emit('sampling-error', payload)
  }

  const registerTargets = async (
    workerClient: WorkerSamplingClient,
    batch: SamplingTarget[],
    token: number,
  ) => {
    await Promise.all(
      batch.map(async (target) => {
        if (revisions.has(target.request.datasetId)) return
        const response = await workerClient.send({
          type: 'register-dataset',
          requestId: ++requestId,
          datasetId: target.request.datasetId,
          revision: 0,
          dataset: target.source.toWorkerDataset(),
        })
        if (
          !samplingScheduler.isCurrent(token) ||
          !isDatasetResponse(response) ||
          (response.status !== 'ok' && response.status !== 'stale-revision')
        ) {
          return
        }
        revisions.set(target.request.datasetId, response.revision)
      }),
    )
  }

  const runSampling = async (token: number, useAutoHysteresis = false) => {
    const currentTargets = targets.value
    const nextOverrides: Record<string, WaveformPoint[]> = { ...context.linePointOverrides.value }
    const sampledTargets: SamplingTarget[] = []
    const diagnostics: WorkerSamplingDiagnostics[] = []
    currentTargets.forEach((target) => {
      const visiblePointCount = target.visibleRange.end - target.visibleRange.start
      const previousSelectedMode = useAutoHysteresis
        ? selectedModeBySeries.get(target.series.id)
        : undefined
      const autoRaw =
        target.request.mode === 'auto' &&
        resolveAutoSelectedMode(
          visiblePointCount,
          target.request.autoThreshold!,
          target.request.autoHysteresis ?? 0,
          previousSelectedMode,
        ) === 'raw'
      if (target.request.mode === 'raw' || autoRaw) {
        nextOverrides[target.series.id] = target.source.pointsInRange(
          target.visibleRange.start,
          target.visibleRange.end,
        )
        selectedModeBySeries.set(target.series.id, 'raw')
        diagnostics.push(rawDiagnostics(target, token))
      } else {
        if (!nextOverrides[target.series.id]?.length) {
          nextOverrides[target.series.id] = fallbackPoints(
            target,
            context.renderingOptions.value.sampling.maxPointsPerPixel,
          )
        }
        sampledTargets.push({
          ...target,
          request: { ...target.request, previousSelectedMode },
        })
      }
    })
    if (!sampledTargets.length) {
      if (!samplingScheduler.isCurrent(token)) return
      context.linePointOverrides.value = nextOverrides
      emitDiagnostics(diagnostics)
      return
    }

    context.linePointOverrides.value = nextOverrides
    client ??= createWorkerSamplingClient()
    await registerTargets(client, sampledTargets, token)
    if (!samplingScheduler.isCurrent(token)) return
    const batch = sampledTargets.map((target) => ({
      ...target.request,
      revision: revisions.get(target.request.datasetId) ?? 1,
    }))
    let response: SampleViewportResponse
    try {
      const result = await client.send({
        type: 'sample-viewport',
        requestId: ++requestId,
        series: batch,
      })
      if (result.type !== 'sample-viewport-response') return
      response = result
    } catch (error) {
      if (!samplingScheduler.isCurrent(token)) return
      emitErrorOnce(
        errorPayload(
          error instanceof Error ? error.message : String(error),
          context.renderingOptions.value.sampling.mode,
          'javascript',
          sampledTargets.map((target) => target.series.id),
        ),
      )
      return
    }
    if (!samplingScheduler.isCurrent(token)) return
    const sourceById = new Map(sampledTargets.map((target) => [target.series.id, target.source]))
    response.results.forEach((result) => {
      const source = sourceById.get(result.seriesId)
      const selected = source ? sourcePoints(result, source) : undefined
      if (selected && (result.status === 'ok' || result.status === 'wasm-unavailable')) {
        nextOverrides[result.seriesId] = selected
      }
      diagnostics.push(result.diagnostics)
      selectedModeBySeries.set(result.seriesId, result.diagnostics.selectedMode)
      if (result.status === 'wasm-unavailable') {
        emitErrorOnce(
          errorPayload(
            response.workerError ?? 'WASM sampling is unavailable.',
            result.diagnostics.mode,
            result.diagnostics.backend === 'javascript' ? 'javascript' : 'none',
            [result.seriesId],
          ),
        )
      }
    })
    if (response.workerError) {
      emitErrorOnce(
        errorPayload(
          response.workerError,
          context.renderingOptions.value.sampling.mode,
          'javascript',
          sampledTargets.map((target) => target.series.id),
        ),
      )
    }
    if (
      client.workerFailureReason &&
      response.results.every((result) => result.status !== 'wasm-unavailable')
    ) {
      emitErrorOnce(
        errorPayload(
          client.workerFailureReason,
          context.renderingOptions.value.sampling.mode,
          'javascript',
          sampledTargets.map((target) => target.series.id),
        ),
      )
    }
    context.linePointOverrides.value = { ...nextOverrides }
    emitDiagnostics(diagnostics)
  }

  watch(
    targetSignature,
    () => {
      if (autoModeSettleTimer) clearTimeout(autoModeSettleTimer)
      const useAutoHysteresis = hasInitialSamplingRun
      hasInitialSamplingRun = true
      samplingScheduler.schedule((token) => runSampling(token, useAutoHysteresis))
      if (
        useAutoHysteresis &&
        context.renderingOptions.value.sampling.mode === 'auto' &&
        context.renderingOptions.value.sampling.autoHysteresis > 0
      ) {
        autoModeSettleTimer = setTimeout(() => {
          autoModeSettleTimer = undefined
          samplingScheduler.schedule((token) => runSampling(token, false))
        }, AUTO_MODE_SETTLE_DELAY_MS)
      }
    },
    { immediate: true },
  )
  watch(
    context.preparedSeries,
    () => {
      samplingScheduler.cancelPending()
      dataEpoch.value += 1
      context.linePointOverrides.value = {}
      revisions.clear()
      backendBySeries.clear()
      selectedModeBySeries.clear()
      emittedErrors.clear()
      client?.dispose()
      client = undefined
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    if (diagnosticsTimer) clearTimeout(diagnosticsTimer)
    if (autoModeSettleTimer) clearTimeout(autoModeSettleTimer)
    samplingScheduler.dispose()
    client?.dispose()
  })

  return { linePointOverrides: context.linePointOverrides }
}

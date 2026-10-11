import { createWaveformSamplingSession } from './waveformSamplingSession'
import { lineBoundaryIndexes, withLineBoundaries } from '../../core/lineBoundary'
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
import { resolveAutoSelectedMode } from './latestTaskScheduler'
import { isDatasetResponse, type WorkerSamplingClient } from './workerSamplingClient'

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

function fallbackInteriorPoints(target: SamplingTarget) {
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

function errorPayload(
  message: string,
  mode: WaveformSamplingError['mode'],
  fallback: WaveformSamplingError['fallback'],
  seriesIds: string[],
): WaveformSamplingError {
  return { message, mode, fallback, seriesIds }
}

export function useWaveformRenderSampling(context: SamplingContext) {
  const settledSignature = shallowRef<string>()
  const dataEpoch = shallowRef(0)
  const session = createWaveformSamplingSession()
  const {
    revisions,
    backendBySeries,
    selectedModeBySeries,
    emittedErrors,
    pendingDiagnostics,
    scheduler: samplingScheduler,
  } = session

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
              maxPointCount: sampling.maxPointCount,
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
            `${target.request.datasetId}:${target.request.xDomain.join(',')}:${target.request.plotWidth}:${target.visibleRange.start}:${target.visibleRange.end}:${target.request.mode}:${target.request.autoThreshold}:${target.request.autoHysteresis}:${target.request.strategy}:${target.request.maxPointsPerPixel}:${target.request.maxPointCount}:${target.request.rawPointLimit}:${target.request.wasmFailureFallback}:${target.request.lineType}:${target.request.pointType}:${target.request.errorBarVisible}:${target.request.pointMinSpacing}:${target.request.errorBarMinSpacing}`,
        )
        .join('|')}`,
  )

  const flushDiagnostics = () => {
    session.diagnosticsTimer = undefined
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
    if (!session.diagnosticsTimer) session.diagnosticsTimer = setTimeout(flushDiagnostics, 100)
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
          requestId: ++session.requestId,
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
        nextOverrides[target.series.id] = withLineBoundaries(
          target.source.pointsInRange(target.visibleRange.start, target.visibleRange.end),
          target.visibleRange,
          target.source.length,
          (index) => target.source.pointAt(index)!,
        )
        selectedModeBySeries.set(target.series.id, 'raw')
        diagnostics.push(rawDiagnostics(target, token))
      } else {
        if (!nextOverrides[target.series.id]?.length) {
          nextOverrides[target.series.id] = withLineBoundaries(
            fallbackInteriorPoints(target),
            target.visibleRange,
            target.source.length,
            (index) => target.source.pointAt(index)!,
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
    const client = session.getClient()
    let response: SampleViewportResponse
    try {
      await registerTargets(client, sampledTargets, token)
      if (!samplingScheduler.isCurrent(token)) return
      const batch = sampledTargets.map((target) => ({
        ...target.request,
        revision: revisions.get(target.request.datasetId) ?? 1,
      }))
      const result = await client.send({
        type: 'sample-viewport',
        requestId: ++session.requestId,
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
          context.renderingOptions.value.sampling.mode === 'wasm' &&
            context.renderingOptions.value.sampling.wasmFailureFallback === 'error'
            ? 'none'
            : 'javascript',
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
    if (
      response.workerError &&
      response.results.every((result) => result.status !== 'wasm-unavailable')
    ) {
      emitErrorOnce(
        errorPayload(
          response.workerError,
          context.renderingOptions.value.sampling.mode,
          context.renderingOptions.value.sampling.mode === 'wasm' &&
            context.renderingOptions.value.sampling.wasmFailureFallback === 'error'
            ? 'none'
            : 'javascript',
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
          context.renderingOptions.value.sampling.mode === 'wasm' &&
            context.renderingOptions.value.sampling.wasmFailureFallback === 'error'
            ? 'none'
            : 'javascript',
          sampledTargets.map((target) => target.series.id),
        ),
      )
    }
    context.linePointOverrides.value = { ...nextOverrides }
    emitDiagnostics(diagnostics)
  }

  const scheduleSampling = (hysteresis: boolean) => {
    settledSignature.value = undefined
    const signature = targetSignature.value
    samplingScheduler.schedule(async (token) => {
      try {
        await runSampling(token, hysteresis)
      } finally {
        if (samplingScheduler.isCurrent(token)) settledSignature.value = signature
      }
    })
  }

  watch(
    targetSignature,
    () => {
      if (session.autoModeSettleTimer) clearTimeout(session.autoModeSettleTimer)
      const useAutoHysteresis = session.hasInitialSamplingRun
      session.hasInitialSamplingRun = true
      scheduleSampling(useAutoHysteresis)
      if (
        useAutoHysteresis &&
        context.renderingOptions.value.sampling.mode === 'auto' &&
        context.renderingOptions.value.sampling.autoHysteresis > 0
      ) {
        session.autoModeSettleTimer = setTimeout(() => {
          session.autoModeSettleTimer = undefined
          scheduleSampling(false)
        }, AUTO_MODE_SETTLE_DELAY_MS)
      }
    },
    { immediate: true },
  )
  watch(
    context.preparedSeries,
    () => {
      session.invalidate()
      dataEpoch.value += 1
      context.linePointOverrides.value = {}
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => session.dispose())

  return {
    linePointOverrides: context.linePointOverrides,
    ready: () => settledSignature.value === targetSignature.value && !session.autoModeSettleTimer,
  }
}

import { SamplingSession } from './SamplingSession'
import { resolveAutoSelectedMode } from './LatestTaskScheduler'
import { isDatasetResponse, type SamplingClient } from './WorkerSamplingClient'
import { withLineBoundaries } from '../core/lineBoundary'
import type { SampleViewportResponse, WorkerSamplingDiagnostics } from '../core/workerSampling'
import type {
  WaveformPoint,
  WaveformSamplingError,
  WaveformSamplingBackend,
  WaveformSamplingDiagnostics,
} from '../types/chart'
import type { PreparedWaveformSeries } from '../core/preparedWaveformSeries'
import type { TrackLayout } from '../components/core/types'
import type { ResolvedWaveformRenderingOptions } from '../core/renderingOptions'
import {
  sourcePoints,
  rawDiagnostics,
  fallbackInteriorPoints,
  errorPayload,
  buildSamplingTargets,
  samplingSignature,
  type SamplingTarget,
} from './samplingTargets'

export interface SamplingEvents {
  emit(event: 'sampling-complete', diagnostic: WaveformSamplingDiagnostics): void
  emit(event: 'sampling-error', error: WaveformSamplingError): void
  emit(
    event: 'sampling-backend-change',
    payload: {
      seriesId: string
      previous: WaveformSamplingBackend
      current: WaveformSamplingBackend
    },
  ): void
}
export interface SamplingInput {
  series: readonly PreparedWaveformSeries[]
  tracks: readonly TrackLayout[]
  rendering: ResolvedWaveformRenderingOptions
}

/** Shared lifecycle/async orchestration; Vue and native consumers submit immutable snapshots. */
export class RenderSamplingController {
  private readonly session: SamplingSession
  private get revisions() {
    return this.session.revisions
  }
  private get backendBySeries() {
    return this.session.backendBySeries
  }
  private get selectedModeBySeries() {
    return this.session.selectedModeBySeries
  }
  private get emittedErrors() {
    return this.session.emittedErrors
  }
  private get pendingDiagnostics() {
    return this.session.pendingDiagnostics
  }
  private get samplingScheduler() {
    return this.session.scheduler
  }
  private input?: SamplingInput
  private targets: SamplingTarget[] = []
  private epoch = 0
  private disposed = false
  private resultState: 'success' | 'fallback' | 'error' = 'success'
  private settledSignature?: string
  private diagnosticsToken = 0
  signature = ''
  overrides: Record<string, WaveformPoint[]> = {}

  constructor(
    private readonly instanceId: string,
    private readonly events: SamplingEvents,
    private readonly changed: () => void,
    session = new SamplingSession(),
  ) {
    this.session = session
  }

  get state() {
    return this.ready() ? this.resultState : 'pending'
  }
  ready() {
    return (
      !this.disposed &&
      this.settledSignature === this.signature &&
      !this.session.autoModeSettleTimer
    )
  }

  /** Called synchronously when a new viewport/size invalidates in-flight work. */
  invalidatePending() {
    if (this.disposed) return
    this.samplingScheduler.cancelPending()
    this.session.client?.cancelSampling?.()
    this.session.timers.clearTimeout(this.session.autoModeSettleTimer)
    this.session.timers.clearTimeout(this.session.diagnosticsTimer)
    this.session.autoModeSettleTimer = undefined
    this.session.diagnosticsTimer = undefined
    this.pendingDiagnostics.clear()
    this.settledSignature = undefined
    this.signature = ''
  }

  resetData() {
    if (this.disposed) return
    this.invalidatePending()
    this.session.invalidate()
    this.session.datasets.clear()
    this.overrides = {}
    this.targets = []
    this.input = undefined
  }

  prepareReplacement(series: readonly PreparedWaveformSeries[]) {
    if (!this.input) return
    const previous = new Map(this.input.series.map((entry) => [entry.id, entry.source]))
    if (!series.some((entry) => previous.get(entry.id) === entry.source)) this.resetData()
  }

  update(input: SamplingInput) {
    if (this.disposed) return
    if (this.input?.series !== input.series) {
      if (this.input) this.invalidatePending()
      const previous = new Map(this.input?.series.map((series) => [series.id, series.source]))
      this.session.reconcileData(this.instanceId, input.series)
      this.epoch += 1
      this.overrides = Object.fromEntries(
        input.series
          .filter(
            (series) => previous.get(series.id) === series.source && this.overrides[series.id],
          )
          .map((series) => [series.id, this.overrides[series.id]!]),
      )
    }
    this.input = input
    this.targets = buildSamplingTargets(
      this.instanceId,
      input.tracks,
      input.rendering,
      this.revisions,
      this.session.datasets.ids,
    )
    const signature = samplingSignature(this.targets, this.epoch)
    if (signature === this.signature) return
    this.signature = signature
    this.session.timers.clearTimeout(this.session.autoModeSettleTimer)
    const hysteresis = this.session.hasInitialSamplingRun
    this.session.hasInitialSamplingRun = true
    this.scheduleSampling(hysteresis)
    if (
      hysteresis &&
      input.rendering.sampling.mode === 'auto' &&
      input.rendering.sampling.autoHysteresis > 0
    ) {
      this.session.autoModeSettleTimer = this.session.timers.setTimeout(() => {
        this.session.autoModeSettleTimer = undefined
        this.scheduleSampling(false)
      }, 120)
    }
  }

  private flushDiagnostics = () => {
    this.session.diagnosticsTimer = undefined
    const diagnostics = [...this.pendingDiagnostics.values()]
    this.pendingDiagnostics.clear()
    const token = this.diagnosticsToken
    for (const diagnostic of diagnostics) {
      if (!this.samplingScheduler.isCurrent(token)) return
      const previousBackend = this.backendBySeries.get(diagnostic.seriesId)
      this.backendBySeries.set(diagnostic.seriesId, diagnostic.backend)
      if (previousBackend && previousBackend !== diagnostic.backend) {
        this.events.emit('sampling-backend-change', {
          seriesId: diagnostic.seriesId,
          previous: previousBackend,
          current: diagnostic.backend,
        })
        if (!this.samplingScheduler.isCurrent(token)) return
      }
      this.events.emit('sampling-complete', diagnostic)
    }
  }
  private emitDiagnostics(diagnostics: WorkerSamplingDiagnostics[], token: number) {
    if (!this.samplingScheduler.isCurrent(token)) return
    this.diagnosticsToken = token
    diagnostics.forEach((diagnostic) =>
      this.pendingDiagnostics.set(diagnostic.seriesId, {
        ...diagnostic,
        scheduledRequestCount: this.samplingScheduler.metrics.scheduled,
        coalescedRequestCount: this.samplingScheduler.metrics.coalesced,
        maxPendingRequestCount: this.samplingScheduler.metrics.maxPending,
      }),
    )
    if (!this.session.diagnosticsTimer)
      this.session.diagnosticsTimer = this.session.timers.setTimeout(this.flushDiagnostics, 100)
  }

  private emitErrorOnce(payload: WaveformSamplingError) {
    const key = `${payload.mode}:${payload.fallback}:${payload.message}:${payload.seriesIds.join(',')}`
    if (this.emittedErrors.has(key)) return
    this.emittedErrors.add(key)
    this.events.emit('sampling-error', payload)
  }

  private async registerTargets(
    workerClient: SamplingClient,
    batch: SamplingTarget[],
    token: number,
  ) {
    await Promise.all(
      batch.map(async (target) => {
        if (this.revisions.has(target.request.datasetId)) return
        const response = await workerClient.send({
          type: 'register-dataset',
          requestId: ++this.session.requestId,
          datasetId: target.request.datasetId,
          revision: 0,
          dataset: target.source.toWorkerDataset(),
        })
        if (
          !this.samplingScheduler.isCurrent(token) ||
          this.session.datasets.ids.get(target.series.id) !== target.request.datasetId ||
          !isDatasetResponse(response) ||
          (response.status !== 'ok' && response.status !== 'stale-revision')
        ) {
          return
        }
        this.revisions.set(target.request.datasetId, response.revision)
      }),
    )
  }

  private async runSampling(token: number, useAutoHysteresis = false) {
    const currentTargets = this.targets
    const nextOverrides: Record<string, WaveformPoint[]> = { ...this.overrides }
    const sampledTargets: SamplingTarget[] = []
    const diagnostics: WorkerSamplingDiagnostics[] = []
    currentTargets.forEach((target) => {
      const visiblePointCount = target.visibleRange.end - target.visibleRange.start
      const previousSelectedMode = useAutoHysteresis
        ? this.selectedModeBySeries.get(target.series.id)
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
        this.selectedModeBySeries.set(target.series.id, 'raw')
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
      if (!this.samplingScheduler.isCurrent(token)) return
      this.overrides = nextOverrides
      this.changed()
      this.emitDiagnostics(diagnostics, token)
      return
    }

    this.overrides = nextOverrides
    this.changed()
    if (!this.samplingScheduler.isCurrent(token)) return
    const client = this.session.getClient()
    let response: SampleViewportResponse
    try {
      const registration = this.registerTargets(client, sampledTargets, token)
      const sample = () =>
        client.send({
          type: 'sample-viewport',
          requestId: ++this.session.requestId,
          series: sampledTargets.map((target) => ({
            ...target.request,
            revision: this.revisions.get(target.request.datasetId) ?? 1,
          })),
        })
      let result
      if (this.session.pipelineRegistration) {
        // Both transports process registrations before the subsequently submitted sample.
        // Await both promises so registration failures and stale generations remain owned.
        const [, sampled] = await Promise.all([registration, sample()])
        result = sampled
      } else {
        await registration
        if (!this.samplingScheduler.isCurrent(token)) return
        result = await sample()
      }
      if (result.type !== 'sample-viewport-response') {
        if (this.samplingScheduler.isCurrent(token)) this.resultState = 'error'
        return
      }
      response = result
    } catch (error) {
      if (!this.samplingScheduler.isCurrent(token)) return
      this.resultState = 'error'
      this.emitErrorOnce(
        errorPayload(
          error instanceof Error ? error.message : String(error),
          this.input!.rendering.sampling.mode,
          this.input!.rendering.sampling.mode === 'wasm' &&
            this.input!.rendering.sampling.wasmFailureFallback === 'error'
            ? 'none'
            : 'javascript',
          sampledTargets.map((target) => target.series.id),
        ),
      )
      return
    }
    if (!this.samplingScheduler.isCurrent(token)) return
    if (response.workerError || client.workerFailureReason) this.resultState = 'fallback'
    const sourceById = new Map(sampledTargets.map((target) => [target.series.id, target.source]))
    if (
      sampledTargets.some(
        (target) =>
          !response.results.some((result) => result.seriesId === target.series.id && result.output),
      )
    )
      this.resultState = 'error'
    for (const result of response.results) {
      if (!this.samplingScheduler.isCurrent(token)) return
      if (result.status !== 'ok' && this.resultState !== 'error')
        this.resultState = result.output ? 'fallback' : 'error'
      const source = sourceById.get(result.seriesId)
      const selected = source ? sourcePoints(result, source) : undefined
      if (selected && (result.status === 'ok' || result.status === 'wasm-unavailable')) {
        nextOverrides[result.seriesId] = selected
      }
      diagnostics.push(result.diagnostics)
      this.selectedModeBySeries.set(result.seriesId, result.diagnostics.selectedMode)
      if (result.status === 'wasm-unavailable') {
        this.emitErrorOnce(
          errorPayload(
            response.workerError ?? 'WASM sampling is unavailable.',
            result.diagnostics.mode,
            result.diagnostics.backend === 'javascript' ? 'javascript' : 'none',
            [result.seriesId],
          ),
        )
      }
    }
    if (!this.samplingScheduler.isCurrent(token)) return
    if (
      response.workerError &&
      response.results.every((result) => result.status !== 'wasm-unavailable')
    ) {
      this.emitErrorOnce(
        errorPayload(
          response.workerError,
          this.input!.rendering.sampling.mode,
          this.input!.rendering.sampling.mode === 'wasm' &&
            this.input!.rendering.sampling.wasmFailureFallback === 'error'
            ? 'none'
            : 'javascript',
          sampledTargets.map((target) => target.series.id),
        ),
      )
    }
    if (!this.samplingScheduler.isCurrent(token)) return
    if (
      client.workerFailureReason &&
      response.results.every((result) => result.status !== 'wasm-unavailable')
    ) {
      this.emitErrorOnce(
        errorPayload(
          client.workerFailureReason,
          this.input!.rendering.sampling.mode,
          this.input!.rendering.sampling.mode === 'wasm' &&
            this.input!.rendering.sampling.wasmFailureFallback === 'error'
            ? 'none'
            : 'javascript',
          sampledTargets.map((target) => target.series.id),
        ),
      )
    }
    if (!this.samplingScheduler.isCurrent(token)) return
    this.overrides = { ...nextOverrides }
    this.changed()
    this.emitDiagnostics(diagnostics, token)
  }

  private scheduleSampling(hysteresis: boolean) {
    this.settledSignature = undefined
    const signature = this.signature
    this.resultState = 'success'
    this.samplingScheduler.schedule(async (token) => {
      try {
        await this.runSampling(token, hysteresis)
      } finally {
        if (this.samplingScheduler.isCurrent(token)) {
          this.settledSignature = signature
          this.changed()
        }
      }
    })
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.session.dispose()
    this.overrides = {}
    this.targets = []
    this.input = undefined
  }
}

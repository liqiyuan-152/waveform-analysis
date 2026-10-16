import { SamplingDatasetRegistry } from './SamplingDatasetRegistry'
import type { PreparedWaveformSeries } from '../core/preparedWaveformSeries'
import { LatestTaskScheduler } from './LatestTaskScheduler'
import { WorkerSamplingClient, type SamplingClient } from './WorkerSamplingClient'
import type { WorkerSamplingDiagnostics } from '../core/workerSampling'

export type SamplingTimer = number | ReturnType<typeof setTimeout>
export interface SamplingTimers {
  setTimeout(callback: () => void, delay: number): SamplingTimer
  clearTimeout(timer: SamplingTimer | undefined): void
}
const defaultTimers: SamplingTimers = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
}

/** Owns transport, timers and per-generation sampling decisions for one chart. */
export class SamplingSession {
  readonly scheduler = new LatestTaskScheduler()
  readonly datasets = new SamplingDatasetRegistry()
  readonly revisions = new Map<string, number>()
  readonly backendBySeries = new Map<string, WorkerSamplingDiagnostics['backend']>()
  readonly selectedModeBySeries = new Map<string, 'raw' | 'sampled'>()
  readonly emittedErrors = new Set<string>()
  readonly pendingDiagnostics = new Map<string, WorkerSamplingDiagnostics>()
  private disposed = false
  client?: SamplingClient
  requestId = 0
  diagnosticsTimer?: SamplingTimer
  autoModeSettleTimer?: SamplingTimer
  hasInitialSamplingRun = false

  constructor(
    private readonly createClient: () => SamplingClient = () => new WorkerSamplingClient(),
    readonly timers: SamplingTimers = defaultTimers,
    private readonly reuseTransport = false,
    readonly pipelineRegistration = false,
  ) {}

  getClient() {
    if (this.disposed) throw new Error('Sampling session was disposed.')
    return (this.client ??= this.createClient())
  }

  reconcileData(instanceId: string, series: readonly PreparedWaveformSeries[]) {
    const retired = this.datasets.reconcile(instanceId, series)
    if (!retired.length) return
    if (this.client && !this.client.invalidateDatasets) {
      this.invalidate()
      return
    }
    this.client?.invalidateDatasets?.(new Set(retired.map((entry) => entry.datasetId)))
    for (const { seriesId, datasetId } of retired) {
      this.revisions.delete(datasetId)
      this.backendBySeries.delete(seriesId)
      this.selectedModeBySeries.delete(seriesId)
      this.pendingDiagnostics.delete(seriesId)
    }
    this.emittedErrors.clear()
    // A complete replacement has no previous sampling decision to stabilize.
    if (!this.selectedModeBySeries.size) this.hasInitialSamplingRun = false
  }

  invalidate() {
    this.scheduler.cancelPending()
    this.timers.clearTimeout(this.diagnosticsTimer)
    this.timers.clearTimeout(this.autoModeSettleTimer)
    this.diagnosticsTimer = undefined
    this.autoModeSettleTimer = undefined
    this.hasInitialSamplingRun = false
    this.pendingDiagnostics.clear()
    this.revisions.clear()
    this.backendBySeries.clear()
    this.selectedModeBySeries.clear()
    this.emittedErrors.clear()
    if (
      this.reuseTransport &&
      !this.disposed &&
      this.client?.reset &&
      !this.client.workerFailureReason
    )
      this.client.reset()
    else {
      this.client?.dispose()
      this.client = undefined
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.invalidate()
    this.scheduler.dispose()
    this.datasets.clear()
  }
}

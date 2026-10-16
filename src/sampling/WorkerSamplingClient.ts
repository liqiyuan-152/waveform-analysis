import { WorkerSamplingRepository } from '../core/workerSampling'
import type {
  DatasetResponse,
  WorkerSamplingRequest,
  WorkerSamplingResponse,
} from '../core/workerSampling'
import type { WaveformPoint } from '../types/chart'
import type { WorkerSamplingDataset } from '../core/waveformPointSource'
import type { SamplingTimers, SamplingTimer } from './SamplingSession'

interface StoredDataset {
  points?: readonly WaveformPoint[]
  dataset?: WorkerSamplingDataset
  revision: number
}
interface PendingRequest {
  request: WorkerSamplingRequest
  deadline?: SamplingTimer
  resolve: (response: WorkerSamplingResponse) => void
  reject: (error: Error) => void
}
export interface SamplingClient {
  readonly workerFailureReason: string | undefined
  send(request: WorkerSamplingRequest): Promise<WorkerSamplingResponse>
  reset?(): void
  invalidateDatasets?(ids: ReadonlySet<string>): void
  cancelSampling?(): void
  dispose(): void
}

interface TransportOptions {
  timers?: SamplingTimers
  deadlineMs?: number
}
const defaultTimers: SamplingTimers = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
}

/** Worker transport with a local repository strategy after loading/transport failures. */
export class WorkerSamplingClient implements SamplingClient {
  private disposed = false
  private worker?: Worker
  private fallback?: WorkerSamplingRepository
  private failureReason?: string
  private readonly pending = new Map<number, PendingRequest>()
  private readonly datasets = new Map<string, StoredDataset>()

  private readonly timers: SamplingTimers
  private readonly deadlineMs: number

  constructor(
    ownerWindow: Pick<typeof globalThis, 'Worker'> = globalThis,
    preloadWasm = false,
    options: TransportOptions = {},
  ) {
    this.timers = options.timers ?? defaultTimers
    this.deadlineMs =
      Number.isFinite(options.deadlineMs) && options.deadlineMs! > 0 ? options.deadlineMs! : 30_000
    const Worker = ownerWindow.Worker
    try {
      if (typeof Worker === 'undefined') this.fallBackToJavascript()
      else {
        this.worker = preloadWasm
          ? new Worker(new URL('../core/workerSampling/nativeWorkerRuntime.ts', import.meta.url), {
              type: 'module',
            })
          : new Worker(new URL('../core/workerSampling/workerRuntime.ts', import.meta.url), {
              type: 'module',
            })
        this.worker.onmessage = (
          event: MessageEvent<
            WorkerSamplingResponse | { type: 'request-error'; requestId: number; message: string }
          >,
        ) => {
          if (this.disposed || !this.worker) return
          const pending = this.pending.get(event.data.requestId)
          if (!pending) return
          if (event.data.type === 'request-error') {
            this.fallBackToJavascript(event.data.message)
            return
          }
          this.settle(event.data.requestId, event.data)
        }
        this.worker.onerror = (event) => this.fallBackToJavascript(event.message)
        this.worker.onmessageerror = () => this.fallBackToJavascript()
      }
    } catch {
      this.fallBackToJavascript()
    }
  }

  get workerFailureReason() {
    return this.failureReason
  }

  private releaseWorker() {
    if (!this.worker) return
    this.worker.onmessage = null
    this.worker.onerror = null
    this.worker.onmessageerror = null
    this.worker.terminate()
    this.worker = undefined
  }

  private fallbackRepository() {
    if (this.fallback) return this.fallback
    const repository = new WorkerSamplingRepository()
    this.fallback = repository
    for (const [datasetId, dataset] of this.datasets)
      repository.restoreDataset(datasetId, dataset.revision, dataset.points, dataset.dataset)
    return repository
  }

  private recordDatasetRequest(request: WorkerSamplingRequest) {
    if (
      (request.type === 'register-dataset' && !this.datasets.has(request.datasetId)) ||
      (request.type === 'replace-dataset' &&
        this.datasets.get(request.datasetId)?.revision === request.revision)
    )
      this.datasets.set(request.datasetId, {
        points: request.points,
        dataset: request.dataset,
        revision: request.type === 'register-dataset' ? 1 : request.revision + 1,
      })
    if (
      request.type === 'dispose-dataset' &&
      this.datasets.get(request.datasetId)?.revision === request.revision
    )
      this.datasets.delete(request.datasetId)
    if (request.type === 'dispose-all') this.datasets.clear()
  }

  private fallBackToJavascript(message?: string) {
    if (this.disposed || this.fallback) return
    this.failureReason = message || 'Web Worker is unavailable; JavaScript sampling is being used.'
    this.releaseWorker()
    const outstanding = [...this.pending.values()]
    try {
      const repository = this.fallbackRepository()
      for (const { request } of outstanding) {
        try {
          this.settle(request.requestId, repository.handle(request))
        } catch (error) {
          this.settle(request.requestId, undefined, error)
        }
      }
    } catch (error) {
      outstanding.forEach(({ request }) => this.settle(request.requestId, undefined, error))
    }
  }

  private settle(id: number, response?: WorkerSamplingResponse, error?: unknown) {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)
    this.timers.clearTimeout(pending.deadline)
    if (response) pending.resolve(response)
    else pending.reject(error instanceof Error ? error : new Error(String(error)))
  }

  private cancelWhere(matches: (request: WorkerSamplingRequest) => boolean, message: string) {
    for (const { request } of this.pending.values())
      if (matches(request)) this.settle(request.requestId, undefined, new Error(message))
  }

  cancelSampling() {
    this.cancelWhere(
      (request) => request.type === 'sample-viewport' || request.type === 'register-dataset',
      'Sampling dataset was invalidated.',
    )
  }

  invalidateDatasets(ids: ReadonlySet<string>) {
    if (this.datasets.size && [...this.datasets.keys()].every((id) => ids.has(id))) {
      this.reset()
      return
    }
    this.cancelWhere(
      (request) =>
        request.type === 'sample-viewport'
          ? request.series.some((series) => ids.has(series.datasetId))
          : 'datasetId' in request && ids.has(request.datasetId),
      'Sampling dataset was invalidated.',
    )
    for (const id of ids) {
      const dataset = this.datasets.get(id)
      if (!dataset) continue
      this.datasets.delete(id)
      const request = {
        type: 'dispose-dataset',
        requestId: --this.cleanupId,
        datasetId: id,
        revision: dataset.revision,
      } as const
      if (this.fallback) this.fallback.handle(request)
      else {
        try {
          this.worker!.postMessage(request)
        } catch {
          this.fallBackToJavascript()
        }
      }
    }
  }
  private cleanupId = 0

  send(request: WorkerSamplingRequest): Promise<WorkerSamplingResponse> {
    if (this.disposed) return Promise.reject(new Error('Sampling client was disposed.'))
    this.recordDatasetRequest(request)
    return new Promise((resolve, reject) => {
      const pending: PendingRequest = { request, resolve, reject }
      this.pending.set(request.requestId, pending)
      if (this.fallback) {
        void Promise.resolve().then(() => {
          if (!this.pending.has(request.requestId)) return
          try {
            this.settle(request.requestId, this.fallback!.handle(request))
          } catch (error) {
            this.settle(request.requestId, undefined, error)
          }
        })
        return
      }
      pending.deadline = this.timers.setTimeout(() => {
        this.fallBackToJavascript('Sampling Worker request timed out at its deadline.')
      }, this.deadlineMs)
      try {
        this.worker!.postMessage(request)
      } catch {
        this.fallBackToJavascript()
      }
    })
  }

  /** Reject obsolete requests before clearing datasets, while retaining the owned transport. */
  reset() {
    if (this.disposed) return
    this.cancelWhere(() => true, 'Sampling dataset was invalidated.')
    this.datasets.clear()
    const request = { type: 'dispose-all', requestId: 0 } as const
    if (this.fallback) this.fallback.handle(request)
    else {
      try {
        this.worker!.postMessage(request)
      } catch {
        this.fallBackToJavascript()
      }
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.releaseWorker()
    this.fallback?.handle({ type: 'dispose-all', requestId: 0 })
    this.cancelWhere(() => true, 'Sampling client was disposed.')
    this.datasets.clear()
    this.fallback = undefined
  }
}

export function createWorkerSamplingClient(): SamplingClient {
  return new WorkerSamplingClient()
}
export function isDatasetResponse(response: WorkerSamplingResponse): response is DatasetResponse {
  return response.type === 'dataset-response'
}

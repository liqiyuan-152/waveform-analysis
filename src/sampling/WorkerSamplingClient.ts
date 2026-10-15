import { WorkerSamplingRepository } from '../core/workerSampling'
import type {
  DatasetResponse,
  WorkerSamplingRequest,
  WorkerSamplingResponse,
} from '../core/workerSampling'
import type { WaveformPoint } from '../types/chart'
import type { WorkerSamplingDataset } from '../core/waveformPointSource'

interface StoredDataset {
  points?: readonly WaveformPoint[]
  dataset?: WorkerSamplingDataset
  revision: number
}
interface PendingRequest {
  request: WorkerSamplingRequest
  resolve: (response: WorkerSamplingResponse) => void
  reject: (error: Error) => void
}
export interface SamplingClient {
  readonly workerFailureReason: string | undefined
  send(request: WorkerSamplingRequest): Promise<WorkerSamplingResponse>
  reset?(): void
  dispose(): void
}

/** Worker transport with a local repository strategy after loading/transport failures. */
export class WorkerSamplingClient implements SamplingClient {
  private disposed = false
  private generation = 0
  private worker?: Worker
  private fallback?: WorkerSamplingRepository
  private failureReason?: string
  private readonly pending = new Map<number, PendingRequest>()
  private readonly datasets = new Map<string, StoredDataset>()

  constructor(ownerWindow: Pick<typeof globalThis, 'Worker'> = globalThis, preloadWasm = false) {
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
          this.pending.delete(event.data.requestId)
          pending.resolve(event.data)
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
    for (const [datasetId, dataset] of this.datasets) {
      repository.handle({
        type: 'register-dataset',
        requestId: 0,
        datasetId,
        revision: 0,
        points: dataset.points,
        dataset: dataset.dataset,
      })
      for (let revision = 1; revision < dataset.revision; revision++)
        repository.handle({
          type: 'replace-dataset',
          requestId: 0,
          datasetId,
          revision,
          points: dataset.points,
          dataset: dataset.dataset,
        })
    }
    return repository
  }

  private recordDatasetRequest(request: WorkerSamplingRequest) {
    if (request.type === 'register-dataset' || request.type === 'replace-dataset')
      this.datasets.set(request.datasetId, {
        points: request.points,
        dataset: request.dataset,
        revision: request.type === 'register-dataset' ? 1 : request.revision + 1,
      })
    if (request.type === 'dispose-dataset') this.datasets.delete(request.datasetId)
    if (request.type === 'dispose-all') this.datasets.clear()
  }

  private fallBackToJavascript(message?: string) {
    if (this.disposed || this.fallback) return
    this.failureReason = message || 'Web Worker is unavailable; JavaScript sampling is being used.'
    this.releaseWorker()
    const outstanding = [...this.pending.values()]
    this.pending.clear()
    try {
      const repository = this.fallbackRepository()
      outstanding.forEach(({ request, resolve, reject }) => {
        try {
          resolve(repository.handle(request))
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
    } catch (error) {
      outstanding.forEach(({ reject }) =>
        reject(error instanceof Error ? error : new Error(String(error))),
      )
    }
  }

  send(request: WorkerSamplingRequest): Promise<WorkerSamplingResponse> {
    if (this.disposed) return Promise.reject(new Error('Sampling client was disposed.'))
    this.recordDatasetRequest(request)
    const generation = this.generation
    if (this.fallback)
      return Promise.resolve().then(() => {
        if (this.disposed) throw new Error('Sampling client was disposed.')
        if (generation !== this.generation) throw new Error('Sampling dataset was invalidated.')
        return this.fallback!.handle(request)
      })
    return new Promise((resolve, reject) => {
      this.pending.set(request.requestId, { request, resolve, reject })
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
    this.generation += 1
    this.pending.forEach(({ reject }) => reject(new Error('Sampling dataset was invalidated.')))
    this.pending.clear()
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
    this.pending.forEach(({ reject }) => reject(new Error('Sampling client was disposed.')))
    this.pending.clear()
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

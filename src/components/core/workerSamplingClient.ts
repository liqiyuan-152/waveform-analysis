import { WorkerSamplingRepository } from '../../core/workerSampling'
import type {
  DatasetResponse,
  WorkerSamplingRequest,
  WorkerSamplingResponse,
} from '../../core/workerSampling'
import type { WaveformPoint } from '../../types'
import type { WorkerSamplingDataset } from '../../core/waveformPointSource'

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

export interface WorkerSamplingClient {
  readonly workerFailureReason: string | undefined
  send(request: WorkerSamplingRequest): Promise<WorkerSamplingResponse>
  dispose(): void
}

function workerFailureMessage(event?: ErrorEvent) {
  return event?.message || 'Web Worker is unavailable; JavaScript sampling is being used.'
}

export function createWorkerSamplingClient(): WorkerSamplingClient {
  let worker: Worker | undefined
  let fallback: WorkerSamplingRepository | undefined
  let workerFailureReason: string | undefined
  const pending = new Map<number, PendingRequest>()
  const datasets = new Map<string, StoredDataset>()

  const fallbackRepository = () => {
    fallback ??= new WorkerSamplingRepository()
    for (const [datasetId, dataset] of datasets) {
      fallback.handle({
        type: 'register-dataset',
        requestId: 0,
        datasetId,
        revision: 0,
        points: dataset.points,
        dataset: dataset.dataset,
      })
      for (let revision = 1; revision < dataset.revision; revision += 1) {
        fallback.handle({
          type: 'replace-dataset',
          requestId: 0,
          datasetId,
          revision,
          points: dataset.points,
          dataset: dataset.dataset,
        })
      }
    }
    return fallback
  }

  const recordDatasetRequest = (request: WorkerSamplingRequest) => {
    if (request.type === 'register-dataset') {
      datasets.set(request.datasetId, {
        points: request.points,
        dataset: request.dataset,
        revision: 1,
      })
    }
    if (request.type === 'replace-dataset') {
      datasets.set(request.datasetId, {
        points: request.points,
        dataset: request.dataset,
        revision: request.revision + 1,
      })
    }
    if (request.type === 'dispose-dataset') datasets.delete(request.datasetId)
    if (request.type === 'dispose-all') datasets.clear()
  }

  const resolveFallbackRequests = () => {
    const outstanding = [...pending.values()]
    pending.clear()
    const repository = fallbackRepository()
    outstanding.forEach(({ request, resolve }) => resolve(repository.handle(request)))
  }

  const fallBackToJavascript = (event?: ErrorEvent) => {
    if (fallback) return
    workerFailureReason = workerFailureMessage(event)
    worker?.terminate()
    worker = undefined
    resolveFallbackRequests()
  }

  try {
    if (typeof Worker === 'undefined') fallBackToJavascript()
    else {
      worker = new Worker(new URL('../../core/workerSampling/workerRuntime.ts', import.meta.url), {
        type: 'module',
      })
      worker.onmessage = (event: MessageEvent<WorkerSamplingResponse>) => {
        const request = pending.get(event.data.requestId)
        if (!request) return
        pending.delete(event.data.requestId)
        request.resolve(event.data)
      }
      worker.onerror = (event) => fallBackToJavascript(event)
      worker.onmessageerror = () => fallBackToJavascript()
    }
  } catch {
    fallBackToJavascript()
  }

  return {
    get workerFailureReason() {
      return workerFailureReason
    },
    send(request) {
      recordDatasetRequest(request)
      if (fallback) return Promise.resolve(fallbackRepository().handle(request))
      return new Promise<WorkerSamplingResponse>((resolve, reject) => {
        pending.set(request.requestId, { request, resolve, reject })
        try {
          worker?.postMessage(request)
        } catch {
          pending.delete(request.requestId)
          fallBackToJavascript()
          resolve(fallbackRepository().handle(request))
        }
      })
    },
    dispose() {
      worker?.terminate()
      worker = undefined
      pending.forEach(({ reject }) => reject(new Error('Sampling client was disposed.')))
      pending.clear()
      datasets.clear()
      fallback = undefined
    },
  }
}

export function isDatasetResponse(response: WorkerSamplingResponse): response is DatasetResponse {
  return response.type === 'dataset-response'
}

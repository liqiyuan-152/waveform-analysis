import { createInitializedWasmSamplingBackend, initializeWasmSampling } from '../wasmSampling'
import { WorkerSamplingRepository } from './repository'
import type { WorkerSamplingRequest, WorkerSamplingResponse } from './protocol'

const repository = new WorkerSamplingRepository()
let wasmInitialization: Promise<void> | undefined
let wasmInitializationError: string | undefined

function requiresWasm(request: WorkerSamplingRequest) {
  return (
    request.type === 'sample-viewport' && request.series.some((series) => series.mode !== 'raw')
  )
}

async function initializeWasmBackend() {
  if (wasmInitializationError) return
  wasmInitialization ??= initializeWasmSampling()
    .then(() => {
      repository.setWasmBackend(createInitializedWasmSamplingBackend())
    })
    .catch((error: unknown) => {
      wasmInitializationError = error instanceof Error ? error.message : String(error)
    })
  await wasmInitialization
}

function addWasmError(response: WorkerSamplingResponse): WorkerSamplingResponse {
  if (response.type !== 'sample-viewport-response' || !wasmInitializationError) return response
  return { ...response, workerError: wasmInitializationError }
}

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<WorkerSamplingRequest>) => void) | null
  postMessage: (
    message: WorkerSamplingResponse | { type: 'request-error'; requestId: number; message: string },
  ) => void
}

workerScope.onmessage = async (event: MessageEvent<WorkerSamplingRequest>) => {
  try {
    if (requiresWasm(event.data)) await initializeWasmBackend()
    workerScope.postMessage(addWasmError(repository.handle(event.data)))
  } catch (error) {
    workerScope.postMessage({
      type: 'request-error',
      requestId: event.data.requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

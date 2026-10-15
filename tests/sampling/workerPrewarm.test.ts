import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerSamplingRequest } from '@/core/workerSampling'

const mocks = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>(),
  backend: vi.fn(() => ({ kind: 'wasm' })),
  setBackend: vi.fn(),
  handle: vi.fn((request: { requestId: number }) => ({
    type: 'sample-viewport-response',
    requestId: request.requestId,
    results: [],
  })),
}))
vi.mock('@/core/wasmSampling', () => ({
  initializeWasmSampling: mocks.initialize,
  createInitializedWasmSamplingBackend: mocks.backend,
}))
vi.mock('@/core/workerSampling/repository', () => ({
  WorkerSamplingRepository: class {
    setWasmBackend = mocks.setBackend
    handle = mocks.handle
  },
}))

const scope = globalThis as unknown as {
  onmessage: ((event: { data: WorkerSamplingRequest }) => Promise<void>) | null
}
const previousHandler = scope.onmessage
const postMessage = vi.fn()
const sample = {
  type: 'sample-viewport',
  requestId: 7,
  series: [
    {
      mode: 'wasm',
      seriesId: 's',
      datasetId: 'd',
      revision: 1,
      xDomain: [0, 1],
      plotWidth: 800,
      strategy: 'peak',
    },
  ],
} satisfies WorkerSamplingRequest

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.initialize.mockResolvedValue()
  vi.stubGlobal('postMessage', postMessage)
})
afterEach(() => {
  scope.onmessage = previousHandler
  vi.unstubAllGlobals()
})

describe('native Worker numeric backend startup', () => {
  it('warms without protocol traffic and shares pending initialization with a sample request', async () => {
    let ready!: () => void
    mocks.initialize.mockReturnValue(new Promise<void>((resolve) => (ready = resolve)))
    await import('@/core/workerSampling/nativeWorkerRuntime')
    expect(mocks.initialize).toHaveBeenCalledOnce()
    expect(postMessage).not.toHaveBeenCalled()
    const request = scope.onmessage!({ data: sample })
    expect(mocks.handle).not.toHaveBeenCalled()
    ready()
    await request
    expect(mocks.initialize).toHaveBeenCalledOnce()
    expect(mocks.setBackend).toHaveBeenCalledOnce()
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ requestId: 7 }))
  })

  it('reports warmup failure on the sampling response, without unsolicited errors', async () => {
    mocks.initialize.mockRejectedValue(new Error('WASM load failed'))
    await import('@/core/workerSampling/nativeWorkerRuntime')
    expect(postMessage).not.toHaveBeenCalled()
    await scope.onmessage!({ data: sample })
    expect(mocks.setBackend).not.toHaveBeenCalled()
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 7, workerError: 'WASM load failed' }),
    )
  })

  it('keeps the original Worker lazy for raw requests', async () => {
    await import('@/core/workerSampling/workerRuntime')
    expect(mocks.initialize).not.toHaveBeenCalled()
    await scope.onmessage!({ data: { ...sample, series: [] } })
    expect(mocks.initialize).not.toHaveBeenCalled()
    await scope.onmessage!({ data: sample })
    expect(mocks.initialize).toHaveBeenCalledOnce()
  })
})

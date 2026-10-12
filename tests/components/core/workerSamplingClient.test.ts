import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkerSamplingClient } from '@/components/core/workerSamplingClient'
import type { WorkerSamplingResponse } from '@/core/workerSampling/protocol'

class ControlledWorker {
  static instances: ControlledWorker[] = []
  onmessage:
    | ((event: {
        data: WorkerSamplingResponse | { type: 'request-error'; requestId: number; message: string }
      }) => void)
    | null = null
  onerror: ((event: { message: string }) => void) | null = null
  onmessageerror: (() => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn(() => undefined)
  constructor() {
    ControlledWorker.instances.push(this)
  }
}
afterEach(() => {
  vi.unstubAllGlobals()
  ControlledWorker.instances = []
})
const register = {
  type: 'register-dataset',
  requestId: 1,
  datasetId: 'd',
  revision: 0,
  dataset: { kind: 'typed', x: new Float64Array([0, 1]), y: new Float32Array([2, 3]) },
} as const

describe('sampling Worker client lifecycle', () => {
  it('rejects pending registration on disposal and cannot accept more work', async () => {
    vi.stubGlobal('Worker', ControlledWorker)
    const client = createWorkerSamplingClient()
    const pending = client.send(register)
    const assertion = expect(pending).rejects.toThrow('disposed')
    client.dispose()
    await assertion
    await expect(client.send(register)).rejects.toThrow('disposed')
    expect(ControlledWorker.instances[0]?.terminate).toHaveBeenCalledOnce()
    expect(ControlledWorker.instances[0]?.onmessage).toBeNull()
  })
  it.each(['error', 'messageerror', 'postMessage', 'request-error'] as const)(
    'falls back after %s preserving input buffers',
    async (failure) => {
      vi.stubGlobal('Worker', ControlledWorker)
      const client = createWorkerSamplingClient()
      const worker = ControlledWorker.instances[0]!
      if (failure === 'postMessage')
        worker.postMessage.mockImplementation(() => {
          throw new Error('clone failure')
        })
      const pending = client.send(register)
      if (failure === 'error') worker.onerror?.({ message: 'load failure' })
      if (failure === 'messageerror') worker.onmessageerror?.()
      if (failure === 'request-error')
        worker.onmessage?.({
          data: { type: 'request-error', requestId: 1, message: 'backend exception' },
        })
      await expect(pending).resolves.toMatchObject({ type: 'dataset-response', revision: 1 })
      const response = await client.send({
        type: 'sample-viewport',
        requestId: 2,
        series: [
          {
            seriesId: 's',
            datasetId: 'd',
            revision: 1,
            xDomain: [0, 1],
            plotWidth: 100,
            mode: 'auto',
            autoThreshold: 1,
            strategy: 'peak',
          },
        ],
      })
      expect(response).toMatchObject({ results: [{ diagnostics: { backend: 'javascript' } }] })
      expect(register.dataset.x).toEqual(new Float64Array([0, 1]))
      expect(register.dataset.y.byteLength).toBe(8)
      client.dispose()
    },
  )
  it('matches responses by request ID and ignores unknown results', async () => {
    vi.stubGlobal('Worker', ControlledWorker)
    const client = createWorkerSamplingClient()
    const worker = ControlledWorker.instances[0]!
    const pending = client.send(register)
    worker.onmessage?.({
      data: {
        type: 'dataset-response',
        requestId: 99,
        datasetId: 'other',
        revision: 1,
        status: 'ok',
      },
    })
    worker.onmessage?.({
      data: { type: 'dataset-response', requestId: 1, datasetId: 'd', revision: 1, status: 'ok' },
    })
    await expect(pending).resolves.toMatchObject({ datasetId: 'd' })
    client.dispose()
  })
})

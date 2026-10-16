import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkerSamplingClient } from '@/sampling/WorkerSamplingClient'
import * as datasetPreparation from '@/core/workerSampling/repositoryDataset'
import type { WorkerSamplingResponse } from '@/core/workerSampling'

class SilentWorker {
  static latest: SilentWorker
  onmessage: ((event: { data: WorkerSamplingResponse }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() {
    SilentWorker.latest = this
  }
  reply(requestId: number, datasetId: string, revision = 1) {
    this.onmessage?.({
      data: { type: 'dataset-response', requestId, datasetId, revision, status: 'ok' },
    })
  }
}
const clients: WorkerSamplingClient[] = []
afterEach(() => {
  clients.splice(0).forEach((client) => client.dispose())
  vi.restoreAllMocks()
  vi.useRealTimers()
})
function setup() {
  vi.useFakeTimers()
  const timers = {
    setTimeout: vi.fn((callback: () => void, delay: number) => setTimeout(callback, delay)),
    clearTimeout: vi.fn((timer: ReturnType<typeof setTimeout> | number | undefined) =>
      clearTimeout(timer),
    ),
  }
  const client = new WorkerSamplingClient(
    { Worker: SilentWorker as unknown as typeof Worker },
    false,
    { timers },
  )
  clients.push(client)
  return { client, worker: SilentWorker.latest, timers }
}
const register = (requestId: number, datasetId = 'a') => ({
  type: 'register-dataset' as const,
  datasetId,
  requestId,
  revision: 0 as const,
  points: [
    { x: 0, y: 2 },
    { x: 1, y: 4 },
  ],
})

describe('finite sampling transport ownership', () => {
  it.each([
    ['raw', 'error', 'ok', 'raw'],
    ['auto', 'error', 'ok', 'javascript'],
    ['wasm', 'javascript', 'wasm-unavailable', 'javascript'],
    ['wasm', 'error', 'wasm-unavailable', 'unavailable'],
  ] as const)(
    'preserves %s/%s semantics after a sampling deadline',
    async (mode, fallback, status, backend) => {
      const { client, worker } = setup()
      const registered = client.send(register(1))
      worker.reply(1, 'a')
      await registered
      const request = {
        type: 'sample-viewport' as const,
        requestId: 2,
        series: [
          {
            datasetId: 'a',
            seriesId: 'a',
            revision: 1,
            xDomain: [0, 1] as [number, number],
            plotWidth: 100,
            mode,
            autoThreshold: 0,
            strategy: 'peak' as const,
            wasmFailureFallback: fallback,
          },
        ],
      }
      const pending = client.send(request)
      const late = worker.onmessage
      await vi.advanceTimersByTimeAsync(30_000)
      const response = await pending
      expect(response).toMatchObject({ results: [{ status, diagnostics: { backend } }] })
      late?.({
        data: {
          type: 'dataset-response',
          requestId: 2,
          datasetId: 'a',
          revision: 999,
          status: 'ok',
        },
      })
      await expect(client.send({ ...request, requestId: 3 })).resolves.toMatchObject({
        results: [{ revision: 1, status, diagnostics: { backend } }],
      })
      expect(worker.terminate).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('terminates a lost transport and settles all shared pending work at the first deadline', async () => {
    const { client, worker } = setup()
    const first = client.send(register(1))
    const second = client.send(register(2, 'b'))
    await vi.advanceTimersByTimeAsync(29_999)
    expect(worker.terminate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await expect(first).resolves.toMatchObject({ datasetId: 'a', revision: 1 })
    await expect(second).resolves.toMatchObject({ datasetId: 'b', revision: 1 })
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(client.workerFailureReason).toMatch(/deadline|timed out/i)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['response', 'reset', 'dispose'] as const)('clears deadline on %s', async (action) => {
    const { client, worker, timers } = setup()
    const pending = client.send(register(1))
    const expected =
      action === 'response'
        ? expect(pending).resolves.toMatchObject({ revision: 1 })
        : expect(pending).rejects.toThrow(action === 'reset' ? 'invalidated' : 'disposed')
    if (action === 'response') worker.reply(1, 'a')
    else client[action]()
    await expected
    expect(timers.clearTimeout).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(client.workerFailureReason).toBeUndefined()
  })

  it('cancels a mixed batch and obsolete registration, then accepts new work before the old deadline', async () => {
    const { client, worker } = setup()
    const registered = client.send(register(1, 'unchanged'))
    worker.reply(1, 'unchanged')
    await registered
    const obsolete = client.send(register(2))
    const oldSample = client.send({
      type: 'sample-viewport',
      requestId: 3,
      series: [
        {
          datasetId: 'a',
          seriesId: 'a',
          revision: 1,
          xDomain: [0, 1],
          plotWidth: 100,
          mode: 'auto',
          strategy: 'peak',
        },
        {
          datasetId: 'unchanged',
          seriesId: 'b',
          revision: 1,
          xDomain: [0, 1],
          plotWidth: 100,
          mode: 'auto',
          strategy: 'peak',
        },
      ],
    })
    const assertions = [
      expect(obsolete).rejects.toThrow('invalidated'),
      expect(oldSample).rejects.toThrow('invalidated'),
    ]
    client.invalidateDatasets(new Set(['a']))
    await Promise.all(assertions)
    const latest = client.send(register(4, 'replacement'))
    worker.reply(2, 'a')
    worker.reply(4, 'replacement')
    await expect(latest).resolves.toMatchObject({ datasetId: 'replacement' })
    expect(worker.terminate).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    worker.onerror?.({ message: 'later transport fault' })
    await expect(
      client.send({ type: 'get-dataset-metrics', requestId: 5, datasetId: 'a', revision: 1 }),
    ).resolves.toMatchObject({ status: 'not-found' })
    await expect(
      client.send({
        type: 'get-dataset-metrics',
        requestId: 6,
        datasetId: 'unchanged',
        revision: 1,
      }),
    ).resolves.toMatchObject({ status: 'ok' })
  })

  it.each([1, 1000])(
    'prepares each current dataset once when recovering revision %i',
    async (revision) => {
      const { client, worker } = setup()
      const prepare = vi.spyOn(datasetPreparation, 'createStoredDataset')
      const first = client.send(register(1))
      worker.reply(1, 'a')
      await first
      for (let i = 1; i < revision; i++) {
        const update = client.send({ ...register(i + 1), type: 'replace-dataset', revision: i })
        worker.reply(i + 1, 'a', i + 1)
        await update
      }
      worker.onerror?.({ message: 'transport fault' })
      expect(prepare).toHaveBeenCalledTimes(1)
      await expect(
        client.send({ type: 'get-dataset-metrics', requestId: 2000, datasetId: 'a', revision }),
      ).resolves.toMatchObject({ status: 'ok', revision })
      const next = await client.send({ ...register(2001), type: 'replace-dataset', revision })
      expect(next).toMatchObject({ status: 'ok', revision: revision + 1 })
      expect(prepare).toHaveBeenCalledTimes(2)
      worker.onerror?.({ message: 'duplicate notification' })
      expect(prepare).toHaveBeenCalledTimes(2)
    },
  )
})

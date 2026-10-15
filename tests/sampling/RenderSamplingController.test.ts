import { afterEach, describe, expect, it, vi } from 'vitest'
import { RenderSamplingController, type SamplingEvents } from '@/sampling/RenderSamplingController'
import { SamplingSession } from '@/sampling/SamplingSession'
import { WorkerSamplingRepository } from '@/core/workerSampling'
import type { WorkerSamplingRequest, WorkerSamplingResponse } from '@/core/workerSampling'
import type { SamplingClient } from '@/sampling/WorkerSamplingClient'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { resolveWaveformRenderingOptions } from '@/core/renderingOptions'
import type { WaveformChartOptions } from '@/types/options'

class ControlledClient implements SamplingClient {
  workerFailureReason = undefined
  readonly repository = new WorkerSamplingRepository()
  readonly pending: Array<{
    request: WorkerSamplingRequest
    resolve: (response: WorkerSamplingResponse) => void
  }> = []
  disposed = false
  send(request: WorkerSamplingRequest): Promise<WorkerSamplingResponse> {
    if (request.type !== 'sample-viewport') return Promise.resolve(this.repository.handle(request))
    return new Promise((resolve) => this.pending.push({ request, resolve }))
  }
  deliver(index = 0) {
    const entry = this.pending[index]!
    entry.resolve(this.repository.handle(entry.request))
  }
  dispose() {
    this.disposed = true
  }
}

const controllers: RenderSamplingController[] = []
afterEach(() => {
  controllers.forEach((controller) => controller.dispose())
  controllers.length = 0
  vi.useRealTimers()
})
const data = {
  kind: 'samples' as const,
  sampleRate: 1000,
  values: Array.from({ length: 5000 }, (_, i) => (i === 2345 ? 1000 : Math.sin(i / 20))),
}

function setup(options: WaveformChartOptions = {}) {
  vi.useFakeTimers()
  const model = new ChartModel({
    data,
    grid: { rowCount: 1, columnCount: 1 },
    rendering: { sampling: { mode: 'auto', maxPointCount: 12, strategy: 'average' } },
    ...options,
  })
  const clients: ControlledClient[] = []
  const session = new SamplingSession(() => {
    const client = new ControlledClient()
    clients.push(client)
    return client
  })
  const emit = vi.fn<(...args: unknown[]) => void>()
  const events: SamplingEvents = { emit }
  const changed = vi.fn()
  const controller = new RenderSamplingController('test', events, changed, session)
  controllers.push(controller)
  const engine = new ChartLayoutEngine(model)
  const update = (width = 800) =>
    controller.update({
      series: model.data.series,
      tracks: engine.calculate(width, 400).trackLayouts,
      rendering: resolveWaveformRenderingOptions(model.options.value.rendering),
    })
  return { model, clients, events, emit, changed, controller, session, update }
}
async function microtasks() {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

describe('shared render sampling lifecycle', () => {
  it('publishes sampled geometry while domains and nearest/range queries retain all original points', async () => {
    const { model, clients, controller, update, events } = setup()
    update()
    await microtasks()
    expect(controller.ready()).toBe(false)
    clients[0]!.deliver()
    await microtasks()
    expect(controller.state).toBe('success')
    expect(controller.overrides['series-0']!.length).toBeLessThan(20)
    expect(controller.overrides['series-0']!.some((point) => point.y === 1000)).toBe(false)
    expect(model.data.series[0]?.yDomain[1]).toBe(1000)
    expect(model.query.nearestPoint('series-0', 2.345)).toMatchObject({ x: 2.345, y: 1000 })
    expect(
      model.query.pointsInDomain('series-0', [2.344, 2.346]).some((point) => point.y === 1000),
    ).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(events.emit).toHaveBeenCalledWith(
      'sampling-complete',
      expect.objectContaining({
        backend: 'javascript',
        sourcePointCount: 5000,
      }),
    )
  })

  it('coalesces rapid view/size changes and rejects older outputs without resetting the business data', async () => {
    const { model, clients, controller, update, session } = setup()
    update()
    await microtasks()
    const initial = controller.overrides['series-0']
    model.viewport.set('series-0', { xDomain: [1, 2], yDomains: {} })
    controller.invalidatePending()
    update(600)
    model.viewport.set('series-0', { xDomain: [3, 4], yDomains: {} })
    update(360)
    clients[0]!.deliver()
    await microtasks()
    expect(controller.overrides['series-0']).toBe(initial)
    expect(controller.ready()).toBe(false)
    expect(clients[0]!.pending).toHaveLength(2)
    const request = clients[0]!.pending[1]!.request
    expect(request).toMatchObject({ series: [{ xDomain: [3, 4] }] })
    clients[0]!.deliver(1)
    await microtasks()
    expect(controller.ready()).toBe(true)
    expect(controller.overrides['series-0']![1]!.x).toBeGreaterThanOrEqual(3)
    expect(session.scheduler.metrics.maxPending).toBe(1)
    expect(session.scheduler.metrics.coalesced).toBeGreaterThanOrEqual(1)
    expect(model.data.series[0]!.source.length).toBe(5000)
  })

  it('disposes old data transports and ignores late results after replacement or destruction', async () => {
    const { model, clients, controller, update, changed, events } = setup()
    update()
    await microtasks()
    controller.resetData()
    model.setOption({ data: { ...data, values: data.values.map((value) => value * 2) } })
    update()
    // New work waits for the stale run to leave the bounded queue; transport disposal makes real clients reject it.
    clients[0]!.deliver()
    await microtasks()
    expect(clients[0]!.disposed).toBe(true)
    expect(clients).toHaveLength(2)
    clients[1]!.deliver()
    await microtasks()
    expect(model.query.nearestPoint('series-0', 2.345)?.y).toBe(2000)
    controller.invalidatePending()
    update(360)
    await microtasks()
    const calls = changed.mock.calls.length
    controller.dispose()
    clients[1]!.deliver(1)
    await microtasks()
    await vi.runAllTimersAsync()
    expect(changed).toHaveBeenCalledTimes(calls)
    expect(events.emit).not.toHaveBeenCalled()
    expect(controller.overrides).toEqual({})
    expect(controller.ready()).toBe(false)
    expect(() => new SamplingSession().dispose()).not.toThrow()
  })

  it('does not resample pure style changes and suppresses stale diagnostic timers', async () => {
    const { model, clients, controller, update, session, events } = setup()
    update()
    await microtasks()
    clients[0]!.deliver()
    await microtasks()
    const runs = session.scheduler.metrics.scheduled
    model.setOption({ lineColor: '#123456', legend: { position: 'bottom' } })
    update()
    expect(session.scheduler.metrics.scheduled).toBe(runs)
    controller.invalidatePending()
    await vi.advanceTimersByTimeAsync(100)
    expect(events.emit).not.toHaveBeenCalled()
  })

  it.each(['javascript', 'error'] as const)(
    'preserves forced-WASM %s fallback and deduplicates errors',
    async (wasmFailureFallback) => {
      const { clients, controller, update, events, emit } = setup({
        rendering: { sampling: { mode: 'wasm', maxPointCount: 12, wasmFailureFallback } },
      })
      update()
      await microtasks()
      clients[0]!.deliver()
      await microtasks()
      expect(controller.state).toBe(wasmFailureFallback === 'javascript' ? 'fallback' : 'error')
      await vi.advanceTimersByTimeAsync(100)
      expect(events.emit).toHaveBeenCalledWith(
        'sampling-error',
        expect.objectContaining({
          mode: 'wasm',
          fallback: wasmFailureFallback === 'javascript' ? 'javascript' : 'none',
        }),
      )
      expect(events.emit).toHaveBeenCalledWith(
        'sampling-complete',
        expect.objectContaining({
          backend: wasmFailureFallback === 'javascript' ? 'javascript' : 'unavailable',
        }),
      )
      controller.invalidatePending()
      update(360)
      await microtasks()
      clients[0]!.deliver(1)
      await microtasks()
      expect(emit.mock.calls.filter(([event]) => event === 'sampling-error')).toHaveLength(1)
    },
  )

  it('keeps auto mode during interaction then settles at the exact threshold', async () => {
    const { model, clients, controller, update, events } = setup({
      rendering: { sampling: { mode: 'auto', autoThreshold: 1000, autoHysteresis: 200 } },
    })
    model.viewport.set('series-0', { xDomain: [0, 0.899], yDomains: {} })
    update()
    await microtasks()
    expect(clients).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(100)
    model.viewport.set('series-0', { xDomain: [0, 1.099], yDomains: {} })
    controller.invalidatePending()
    update()
    await microtasks()
    expect(clients).toHaveLength(0)
    expect(controller.ready()).toBe(false)
    await vi.advanceTimersByTimeAsync(120)
    expect(clients).toHaveLength(1)
    clients[0]!.deliver()
    await microtasks()
    expect(controller.ready()).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(events.emit).toHaveBeenCalledWith('sampling-backend-change', {
      seriesId: 'series-0',
      previous: 'raw',
      current: 'javascript',
    })
  })

  it('stops a diagnostic batch when a consumer disposes in the first callback', async () => {
    const { controller, update, events, session } = setup({
      data: { kind: 'series', series: ['a', 'b'].map((id) => ({ id, name: id, data })) },
      rendering: { sampling: { mode: 'raw' } },
      grid: { rowCount: 2, columnCount: 1 },
    })
    vi.mocked(events.emit).mockImplementation(() => controller.dispose())
    update()
    await microtasks()
    await vi.advanceTimersByTimeAsync(100)
    expect(events.emit).toHaveBeenCalledTimes(1)
    expect(session.backendBySeries.size).toBe(0)
    expect(controller.overrides).toEqual({})
  })

  it('does not republish results or timers after disposal in a sampling-error callback', async () => {
    const { controller, update, events, clients, changed, session } = setup({
      rendering: { sampling: { mode: 'wasm', wasmFailureFallback: 'javascript' } },
    })
    vi.mocked(events.emit).mockImplementation(() => controller.dispose())
    update()
    await microtasks()
    const calls = changed.mock.calls.length
    clients[0]!.deliver()
    await microtasks()
    await vi.runAllTimersAsync()
    expect(events.emit).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledTimes(calls)
    expect(controller.overrides).toEqual({})
    expect(session.diagnosticsTimer).toBeUndefined()
    expect(session.selectedModeBySeries.size).toBe(0)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkerSamplingClient } from '@/sampling/WorkerSamplingClient'
import { WorkerSamplingRepository } from '@/core/workerSampling'
import type { WorkerSamplingRequest, WorkerSamplingResponse } from '@/core/workerSampling'
import { SamplingSession } from '@/sampling/SamplingSession'
import { RenderSamplingController } from '@/sampling/RenderSamplingController'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { resolveWaveformRenderingOptions } from '@/core/renderingOptions'

class ControlledWorker {
  static latest: ControlledWorker
  onmessage: ((event: { data: WorkerSamplingResponse }) => void) | null = null
  onerror = null
  onmessageerror = null
  terminate = vi.fn()
  repository = new WorkerSamplingRepository()
  messages: WorkerSamplingRequest[] = []
  holdSample = true
  holdRegister = false
  held: WorkerSamplingResponse[] = []
  constructor() {
    ControlledWorker.latest = this
  }
  postMessage(request: WorkerSamplingRequest) {
    this.messages.push(request)
    const response = this.repository.handle(request)
    if (
      (request.type === 'sample-viewport' && this.holdSample) ||
      (request.type === 'register-dataset' &&
        this.holdRegister &&
        request.datasetId.includes(':a:'))
    )
      this.held.push(response)
    else queueMicrotask(() => this.onmessage?.({ data: response }))
  }
}
let controller: RenderSamplingController | undefined
afterEach(() => {
  controller?.dispose()
  controller = undefined
  vi.useRealTimers()
})
async function drain() {
  for (let i = 0; i < 40; i++) await Promise.resolve()
}
const child = (y: number) => ({
  kind: 'samples' as const,
  sampleRate: 1000,
  values: Array.from({ length: 6000 }, (_, i) => Math.sin(i) + y),
})

describe('per-source transport invalidation', () => {
  it.each([false, true])(
    'settles a stalled mixed run with registration held=%s and preserves confirmed datasets',
    async (holdRegister) => {
      vi.useFakeTimers()
      const a = { id: 'a', name: 'a', data: child(0) },
        b = { id: 'b', name: 'b', data: child(2) }
      const model = new ChartModel({
        data: { kind: 'series', series: [a, b] },
        grid: { rowCount: 2, columnCount: 1 },
        rendering: {
          sampling: { mode: 'auto', autoThreshold: 100, autoHysteresis: 0, maxPointCount: 12 },
        },
      })
      const client = new WorkerSamplingClient({
        Worker: ControlledWorker as unknown as typeof Worker,
      })
      const worker = ControlledWorker.latest
      worker.holdRegister = holdRegister
      const session = new SamplingSession(() => client, undefined, true, true)
      const emit = vi.fn()
      controller = new RenderSamplingController('incremental', { emit }, () => {}, session)
      const engine = new ChartLayoutEngine(model)
      const update = () =>
        controller!.update({
          series: model.data.series,
          tracks: engine.calculate(800, 400).trackLayouts,
          rendering: resolveWaveformRenderingOptions(model.options.value.rendering),
        })
      update()
      await drain()
      expect(controller.ready()).toBe(false)
      expect(session.revisions.size).toBe(holdRegister ? 1 : 2)
      worker.holdSample = false
      worker.holdRegister = false
      model.setOption({ data: { kind: 'series', series: [{ ...a, data: child(10) }, b] } })
      update()
      await drain()
      expect(controller.ready()).toBe(true)
      expect(controller.overrides.a?.[0]?.y).toBe(10)
      expect(worker.messages.filter((request) => request.type === 'register-dataset')).toHaveLength(
        3,
      )
      expect(
        worker.messages.filter(
          (request) => request.type === 'register-dataset' && request.datasetId.includes(':b:'),
        ),
      ).toHaveLength(1)
      const current = controller.overrides
      for (const response of worker.held) worker.onmessage?.({ data: response })
      await drain()
      await vi.advanceTimersByTimeAsync(100)
      expect(controller.overrides).toBe(current)
      expect(emit.mock.calls.some(([name]) => name === 'sampling-error')).toBe(false)
      expect(worker.terminate).not.toHaveBeenCalled()
      expect(worker.repository.resourceMetrics.datasetCount).toBe(2)
      model.setOption({ data: { kind: 'series', series: [b] } })
      update()
      await drain()
      expect(worker.repository.resourceMetrics.datasetCount).toBe(1)
      expect(controller.overrides.a).toBeUndefined()
      model.setOption({
        data: { kind: 'series', series: [{ ...b, data: child(20) }] },
        rendering: {
          sampling: { mode: 'auto', autoThreshold: 100, autoHysteresis: 0.15, maxPointCount: 12 },
        },
      })
      controller.prepareReplacement(model.data.series)
      update()
      await drain()
      // No unchanged dataset/decision remains: finish without a redundant hysteresis pass.
      expect(controller.ready()).toBe(true)
      expect(controller.overrides.b?.[0]?.y).toBe(20)
      expect(worker.messages.some((request) => request.type === 'dispose-all')).toBe(true)
      expect(worker.repository.resourceMetrics.datasetCount).toBe(1)
      controller.dispose()
      controller = undefined
      expect(vi.getTimerCount()).toBe(0)
    },
  )
})

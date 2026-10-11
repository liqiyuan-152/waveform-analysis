import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSizedChart } from '@tests/support/waveformChart'
import { WorkerSamplingRepository } from '@/core/workerSampling/repository'
import type { WorkerSamplingRequest, WorkerSamplingResponse } from '@/core/workerSampling/protocol'

const originalWorker = globalThis.Worker
class ControlledWorker {
  static instances: ControlledWorker[] = []
  onmessage: ((event: { data: WorkerSamplingResponse }) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  requests: WorkerSamplingRequest[] = []
  repository = new WorkerSamplingRepository()
  terminate = vi.fn()
  constructor() {
    ControlledWorker.instances.push(this)
  }
  postMessage(request: WorkerSamplingRequest) {
    this.requests.push(request)
  }
  respond() {
    const request = this.requests.shift()
    if (request) this.onmessage?.({ data: this.repository.handle(request) })
  }
}
const input = (y: number) => ({
  kind: 'typed-samples' as const,
  values: Float64Array.from({ length: 100 }, (_, i) => i + y),
  sampleRate: 10,
})
const rendering = { sampling: { mode: 'auto', autoThreshold: 2, maxPointCount: 10 } }
afterEach(() => {
  vi.stubGlobal('Worker', originalWorker)
  ControlledWorker.instances = []
})
it('cancels delayed registration on data replacement and ignores the old session response', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const wrapper = await mountSizedChart(input(0), { rendering })
  const old = ControlledWorker.instances[0]!
  const late = old.onmessage!
  await wrapper.setProps({ data: input(1000) })
  await flushPromises()
  expect(old.terminate).toHaveBeenCalledOnce()
  late({ data: old.repository.handle(old.requests[0]!) })
  const current = ControlledWorker.instances.at(-1)!
  current.respond()
  await flushPromises()
  current.respond()
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(wrapper.emitted('sampling-error')).toBeUndefined()
  const diagnostics = wrapper.emitted('sampling-complete') ?? []
  expect(diagnostics).toHaveLength(1)
  expect(wrapper.get('.waveform-chart__line').attributes('d')).not.toContain('NaN')
  wrapper.unmount()
  expect(current.terminate).toHaveBeenCalledOnce()
})
it('unmounts with pending registration without emitting errors or late diagnostics', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const wrapper = await mountSizedChart(input(0), { rendering })
  const worker = ControlledWorker.instances[0]!
  wrapper.unmount()
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(worker.terminate).toHaveBeenCalledOnce()
  expect(wrapper.emitted('sampling-error')).toBeUndefined()
  expect(wrapper.emitted('sampling-complete')).toBeUndefined()
})
it('invalidates diagnostics already queued before data replacement', async () => {
  const wrapper = await mountSizedChart(input(0), { rendering: { sampling: { mode: 'raw' } } })
  await wrapper.setProps({ data: input(1000) })
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(wrapper.emitted('sampling-complete')).toHaveLength(1)
  wrapper.unmount()
})

it('ignores a delayed sampling response after replacing the data reference', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const wrapper = await mountSizedChart(input(0), { rendering })
  const old = ControlledWorker.instances[0]!
  old.respond()
  await flushPromises()
  const late = old.onmessage!
  const staleResponse = old.repository.handle(old.requests[0]!)
  await wrapper.setProps({ data: input(1000) })
  await flushPromises()
  const current = ControlledWorker.instances.at(-1)!
  current.respond()
  await flushPromises()
  current.respond()
  await flushPromises()
  const currentPath = wrapper.get('.waveform-chart__line').attributes('d')
  late({ data: staleResponse })
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(wrapper.get('.waveform-chart__line').attributes('d')).toBe(currentPath)
  expect(wrapper.emitted('sampling-complete')).toHaveLength(1)
  expect(wrapper.emitted('sampling-error')).toBeUndefined()
  wrapper.unmount()
})

it('waits for controlled Worker sampling before exporting and rejects stale versions', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const wrapper = await mountSizedChart(input(0), { rendering })
  const worker = ControlledWorker.instances[0]!
  let completed = false
  const exported = wrapper.vm.exportImage({ format: 'svg' }).then((blob) => {
    completed = true
    return blob
  })
  await flushPromises()
  expect(completed).toBe(false)
  worker.respond()
  await flushPromises()
  expect(completed).toBe(false)
  worker.respond()
  await flushPromises()
  for (let i = 0; i < 10 && worker.requests.length; i++) {
    worker.respond()
    await flushPromises()
  }
  const blob = await exported
  expect(blob.type).toBe('image/svg+xml')
  wrapper.vm.zoomIn()
  await flushPromises()
  const stale = wrapper.vm.exportImage({ format: 'svg' })
  const assertion = expect(stale).rejects.toMatchObject({ code: 'export-stale' })
  await wrapper.setProps({
    annotations: [{ id: 'note', seriesId: 'waveform-0', x: 1, y: 1, text: 'changed' }],
  })
  await assertion
  const cancelled = wrapper.vm.exportImage({ format: 'svg' })
  const cancellation = expect(cancelled).rejects.toMatchObject({ code: 'export-cancelled' })
  wrapper.unmount()
  await cancellation
})

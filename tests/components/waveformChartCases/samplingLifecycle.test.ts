import { afterEach, expect, it, vi } from 'vitest'

import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'
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
async function settleWorker(worker: ControlledWorker) {
  for (let turn = 0; turn < 12 && worker.requests.length; turn++) {
    worker.respond()
    await flushVueChartUpdates()
  }
  expect(worker.requests).toHaveLength(0)
}
it('cancels delayed registration on data replacement and ignores the old session response', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const wrapper = await mountSizedChart(input(0), { rendering })
  const old = ControlledWorker.instances[0]!
  const late = old.onmessage!
  await wrapper.setProps({ data: input(1000) })
  await flushVueChartUpdates()
  expect(old.terminate).not.toHaveBeenCalled()
  late({ data: old.repository.handle(old.requests.shift()!) })
  const current = ControlledWorker.instances.at(-1)!
  expect(current).toBe(old)
  expect(ControlledWorker.instances).toHaveLength(1)
  await settleWorker(current)
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
  await flushVueChartUpdates()
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(worker.terminate).toHaveBeenCalledOnce()
  expect(wrapper.emitted('sampling-error')).toBeUndefined()
  expect(wrapper.emitted('sampling-complete')).toBeUndefined()
})
it('invalidates diagnostics already queued before data replacement', async () => {
  const wrapper = await mountSizedChart(input(0), { rendering: { sampling: { mode: 'raw' } } })
  await wrapper.setProps({ data: input(1000) })
  await flushVueChartUpdates()
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(wrapper.emitted('sampling-complete')).toHaveLength(1)
  wrapper.unmount()
})

it('ignores a delayed sampling response after replacing the data reference', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const wrapper = await mountSizedChart(input(0), { rendering })
  const old = ControlledWorker.instances[0]!
  old.respond()
  await flushVueChartUpdates()
  const late = old.onmessage!
  const staleResponse = old.repository.handle(old.requests.shift()!)
  await wrapper.setProps({ data: input(1000) })
  await flushVueChartUpdates()
  const current = ControlledWorker.instances.at(-1)!
  expect(current).toBe(old)
  expect(ControlledWorker.instances).toHaveLength(1)
  await settleWorker(current)
  const currentPath = wrapper.get('.waveform-chart__line').attributes('d')
  late({ data: staleResponse })
  await flushVueChartUpdates()
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
  await flushVueChartUpdates()
  expect(completed).toBe(false)
  worker.respond()
  await flushVueChartUpdates()
  expect(completed).toBe(false)
  worker.respond()
  await flushVueChartUpdates()
  for (let i = 0; i < 10 && worker.requests.length; i++) {
    worker.respond()
    await flushVueChartUpdates()
  }
  const blob = await exported
  expect(blob.type).toBe('image/svg+xml')
  wrapper.vm.zoomIn()
  await flushVueChartUpdates()
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

it('statically lands the same delayed sampling request after pointer takeover', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  const wrapper = await mountSizedChart(input(0), { rendering })
  const worker = ControlledWorker.instances[0]!
  await wrapper.get('.waveform-chart').trigger('pointermove')
  for (let i = 0; i < 10; i++) {
    worker.respond()
    await flushVueChartUpdates()
  }
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(wrapper.find('.waveform-track__series-item [clipPathUnits]').exists()).toBe(false)
  expect(wrapper.get('.waveform-chart__line').attributes('d')).not.toContain('NaN')
  wrapper.unmount()
  hidden.mockRestore()
})

it('does not animate a settled successful-status response that contains no target geometry', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  const wrapper = await mountSizedChart(input(0), { rendering })
  const worker = ControlledWorker.instances[0]!
  for (let i = 0; i < 10 && worker.requests[0]?.type !== 'sample-viewport'; i++) {
    worker.respond()
    await flushVueChartUpdates()
  }
  const request = worker.requests.shift()!
  const response = worker.repository.handle(request)
  expect(response.type).toBe('sample-viewport-response')
  if (response.type === 'sample-viewport-response') {
    worker.onmessage?.({
      data: {
        ...response,
        results: response.results.map((result) => ({ ...result, output: undefined })),
      },
    })
  }
  await flushVueChartUpdates()
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(wrapper.find('.waveform-track__series-item [clipPathUnits]').exists()).toBe(false)
  const exported = await wrapper.vm.exportImage({ format: 'svg' })
  expect(exported.type).toBe('image/svg+xml')
  wrapper.unmount()
  hidden.mockRestore()
})

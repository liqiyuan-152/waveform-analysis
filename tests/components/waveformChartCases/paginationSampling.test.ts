import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames } from '@tests/support/setup'
import { WorkerSamplingRepository } from '@/core/workerSampling/repository'
import type { WorkerSamplingRequest, WorkerSamplingResponse } from '@/core/workerSampling/protocol'
import { globalAnimator } from '@/animation/core/Animator'

const originalWorker = globalThis.Worker
class ControlledWorker {
  static instances: ControlledWorker[] = []
  onmessage: ((event: { data: WorkerSamplingResponse }) => void) | null = null
  onerror = null
  onmessageerror = null
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
let now = 0
const wrappers: Awaited<ReturnType<typeof mountSizedChart>>[] = []
async function chart() {
  const data = {
    kind: 'series' as const,
    series: [0, 1, 2].map((i) => ({
      id: `channel-${i}`,
      name: `Channel ${i}`,
      data: {
        kind: 'typed-samples' as const,
        values: Float64Array.from({ length: 100 }, (_, x) => Math.sin(x + i)),
        sampleRate: 10,
      },
    })),
  }
  const wrapper = await mountSizedChart(data, {
    grid: { rowCount: 1, columnCount: 1 },
    animation: { duration: 0 },
    animationUpdate: { duration: 1000, easing: 'linear' },
    rendering: { sampling: { mode: 'auto', autoThreshold: 2, maxPointCount: 10 } },
  })
  wrappers.push(wrapper)
  return { wrapper, worker: ControlledWorker.instances.at(-1)! }
}
async function drain(worker: ControlledWorker) {
  for (let i = 0; i < 30; i++) {
    worker.respond()
    await flushPromises()
    await nextTick()
  }
}
const opacity = (wrapper: Awaited<ReturnType<typeof mountSizedChart>>) =>
  Number(wrapper.get('.waveform-track__series-item').attributes('opacity'))
async function nextPage(wrapper: Awaited<ReturnType<typeof mountSizedChart>>) {
  await wrapper.get('.ant-pagination-next button').trigger('click')
  await flushPromises()
  await nextTick()
}
async function frame(ms: number) {
  now += ms
  await vi.advanceTimersByTimeAsync(ms)
  flushAnimationFrames(now)
  await nextTick()
}
beforeEach(() => {
  now = 0
  vi.stubGlobal('Worker', ControlledWorker)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  globalAnimator.destroy()
  vi.stubGlobal('Worker', originalWorker)
  ControlledWorker.instances = []
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('keeps only the latest pending page and ignores a late Worker response', async () => {
  const { wrapper, worker } = await chart()
  await drain(worker)
  await nextPage(wrapper)
  expect(opacity(wrapper)).toBe(0)
  expect(globalAnimator.getAnimationCount()).toBe(0)
  for (let i = 0; i < 10 && worker.requests[0]?.type !== 'sample-viewport'; i++) {
    worker.respond()
    await flushPromises()
  }
  const staleRequest = worker.requests.shift()!
  expect(staleRequest.type).toBe('sample-viewport')
  const stale = worker.repository.handle(staleRequest)
  await nextPage(wrapper)
  worker.onmessage?.({ data: stale })
  await flushPromises()
  expect(opacity(wrapper)).toBe(0)
  expect(wrapper.get('.waveform-chart__line').attributes('data-series-id')).toBe('channel-2')
  await drain(worker)
  await frame(500)
  expect(opacity(wrapper)).toBeCloseTo(0.5)
  worker.onmessage?.({ data: stale })
  await flushPromises()
  expect(opacity(wrapper)).toBeCloseTo(0.5)
  await frame(500)
  expect(opacity(wrapper)).toBe(1)
  expect(wrapper.emitted('page-change')).toEqual([
    [2, 3],
    [3, 3],
  ])
})
it('does not resume pagination fade after pending pointer takeover', async () => {
  const { wrapper, worker } = await chart()
  await drain(worker)
  await nextPage(wrapper)
  expect(opacity(wrapper)).toBe(0)
  await wrapper.get('svg').trigger('pointermove')
  expect(opacity(wrapper)).toBe(1)
  await drain(worker)
  await frame(500)
  expect(opacity(wrapper)).toBe(1)
  expect(globalAnimator.getAnimationCount()).toBe(0)
})
it('exports only after current page sampling and finishes its pending fade', async () => {
  const { wrapper, worker } = await chart()
  await drain(worker)
  await nextPage(wrapper)
  let done = false
  const exported = wrapper.vm.exportImage({ format: 'svg' }).then((blob) => {
    done = true
    return blob
  })
  await flushPromises()
  expect(done).toBe(false)
  expect(opacity(wrapper)).toBe(1)
  await drain(worker)
  await frame(50)
  const blob = await exported
  expect(blob.type).toBe('image/svg+xml')
  expect(opacity(wrapper)).toBe(1)
  expect(globalAnimator.getAnimationCount()).toBe(0)
})
it('shows pending content immediately when zero duration is configured', async () => {
  const { wrapper, worker } = await chart()
  await drain(worker)
  await nextPage(wrapper)
  expect(opacity(wrapper)).toBe(0)
  await wrapper.setProps({ animationUpdate: { duration: 0 } })
  expect(opacity(wrapper)).toBe(1)
  await drain(worker)
  expect(opacity(wrapper)).toBe(1)
  expect(globalAnimator.getAnimationCount()).toBe(0)
})

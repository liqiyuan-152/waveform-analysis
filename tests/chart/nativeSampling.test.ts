import { afterEach, describe, expect, it, vi } from 'vitest'
import { init, getInstanceByDom } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import { WorkerSamplingRepository } from '@/core/workerSampling'
import { WaveformDataManager } from '@/data/WaveformDataManager'
import type { WorkerSamplingRequest, WorkerSamplingResponse } from '@/core/workerSampling'
import { flushNativeUpdates } from '../support/nativeChart'
import { flushAnimationFrames } from '../support/setup'

class ControlledWorker {
  static instances: ControlledWorker[] = []
  onmessage: ((event: { data: WorkerSamplingResponse }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  onmessageerror: (() => void) | null = null
  readonly requests: WorkerSamplingRequest[] = []
  readonly repository = new WorkerSamplingRepository()
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
const originalWorker = globalThis.Worker
const charts: WaveformChartInstance[] = []
afterEach(() => {
  charts.forEach((chart) => chart.dispose())
  charts.length = 0
  ControlledWorker.instances = []
  vi.stubGlobal('Worker', originalWorker)
  vi.useRealTimers()
  vi.restoreAllMocks()
})
const input = (offset = 0) => ({
  kind: 'typed-samples' as const,
  sampleRate: 10,
  values: Float64Array.from({ length: 100 }, (_, i) => offset + i),
})
function create(animationEnabled = false) {
  vi.stubGlobal('Worker', ControlledWorker)
  const host = document.createElement('div')
  const chart = init(
    host,
    {
      width: 800,
      height: 360,
      data: input(),
      animationEnabled,
      rendering: { sampling: { autoThreshold: 2, maxPointCount: 10 } },
    },
    { autoResize: false },
  )
  charts.push(chart)
  return { chart, host }
}

async function settleWorker(worker: ControlledWorker) {
  for (let turn = 0; turn < 12 && worker.requests.length; turn++) {
    worker.respond()
    await flushNativeUpdates()
  }
  expect(worker.requests).toHaveLength(0)
}

describe('native asynchronous sampling integration', () => {
  it('starts one Worker before normalization and keeps its first request a dataset registration', async () => {
    const prepare = WaveformDataManager.prototype.prepare
    const observed = vi
      .spyOn(WaveformDataManager.prototype, 'prepare')
      .mockImplementation(function (this: WaveformDataManager, ...args) {
        expect(ControlledWorker.instances).toHaveLength(1)
        expect(ControlledWorker.instances[0]!.requests).toHaveLength(0)
        return prepare.apply(this, args)
      })
    create()
    expect(observed).toHaveBeenCalledOnce()
    await flushNativeUpdates()
    expect(ControlledWorker.instances).toHaveLength(1)
    expect(ControlledWorker.instances[0]!.requests[0]?.type).toBe('register-dataset')
    expect(ControlledWorker.instances[0]!.requests[1]?.type).toBe('sample-viewport')
  })

  it('terminates an early Worker if normalization fails and allows retry on the same host', () => {
    vi.stubGlobal('Worker', ControlledWorker)
    const host = document.createElement('div')
    vi.spyOn(WaveformDataManager.prototype, 'prepare').mockImplementationOnce(() => {
      throw new Error('normalization failed')
    })
    expect(() =>
      init(host, { data: input(), rendering: { sampling: { autoThreshold: 2 } } }),
    ).toThrow('normalization failed')
    expect(ControlledWorker.instances[0]!.terminate).toHaveBeenCalledOnce()
    expect(host.childElementCount).toBe(0)
    expect(getInstanceByDom(host)).toBeUndefined()
    const chart = init(host)
    charts.push(chart)
    expect(getInstanceByDom(host)).toBe(chart)
  })

  it.each([
    { rendering: { sampling: { mode: 'raw' as const } } },
    { rendering: { sampling: { autoThreshold: 100 } } },
    { hiddenSeriesIds: ['series-0'] },
    { defaultHiddenSeriesIds: ['series-0'] },
  ])('does not prestart a Worker for raw, small or hidden input: %j', (options) => {
    vi.stubGlobal('Worker', ControlledWorker)
    const prepare = WaveformDataManager.prototype.prepare
    vi.spyOn(WaveformDataManager.prototype, 'prepare').mockImplementation(function (
      this: WaveformDataManager,
      ...args
    ) {
      expect(ControlledWorker.instances).toHaveLength(0)
      return prepare.apply(this, args)
    })
    const chart = init(document.createElement('div'), { data: input(), ...options })
    charts.push(chart)
  })

  it('starts entrance only after Worker sampling and waits for its final draw before finished', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let time = 0
    vi.spyOn(performance, 'now').mockImplementation(() => time)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    const { chart, host } = create(true)
    chart.setOption({ animation: { duration: 500, easing: 'linear' } })
    const finished = vi.fn()
    chart.on('finished', finished)
    await flushNativeUpdates()
    const worker = ControlledWorker.instances[0]!
    expect(
      Number(host.querySelector('.waveform-chart__series defs rect')?.getAttribute('width')),
    ).toBe(0)
    worker.respond()
    await flushNativeUpdates()
    expect(finished).not.toHaveBeenCalled()
    worker.respond()
    for (let turn = 0; turn < 8; turn++) {
      flushAnimationFrames(time)
      await Promise.resolve()
    }
    expect(finished).not.toHaveBeenCalled()
    expect(host.querySelector('.waveform-chart__series defs rect')).not.toBeNull()
    time = 500
    await vi.advanceTimersByTimeAsync(500)
    for (let turn = 0; turn < 4; turn++) {
      flushAnimationFrames(time)
      await Promise.resolve()
    }
    expect(host.querySelector('.waveform-chart__series defs rect')).toBeNull()
    expect(finished).toHaveBeenCalledOnce()
  })
  it('waits for current sampling to draw before finished and export, and ignores pure color updates', async () => {
    const { chart, host } = create()
    const finished = vi.fn()
    chart.on('finished', finished)
    await flushNativeUpdates()
    const worker = ControlledWorker.instances[0]!
    const exporting = chart.exportImage({ format: 'svg' })
    let exported = false
    void exporting.then(() => {
      exported = true
    })
    expect(worker.requests[0]?.type).toBe('register-dataset')
    expect(finished).not.toHaveBeenCalled()
    worker.respond()
    await flushNativeUpdates()
    expect(worker.requests[0]?.type).toBe('sample-viewport')
    expect(finished).not.toHaveBeenCalled()
    expect(exported).toBe(false)
    worker.respond()
    await flushNativeUpdates()
    expect(finished).toHaveBeenCalledOnce()
    expect(
      (host.querySelector('.waveform-chart__line')?.getAttribute('d')?.match(/[ML]/g) ?? []).length,
    ).toBeLessThan(20)
    await expect(exporting).resolves.toBeInstanceOf(Blob)
    chart.setOption({ lineColor: 'red' })
    await flushNativeUpdates()
    expect(worker.requests).toHaveLength(0)
    expect(host.querySelector('.waveform-chart__line')?.getAttribute('stroke')).toBe('red')
    expect(finished).toHaveBeenCalledTimes(2)
  })

  it('rejects an export superseded during Worker sampling and retries with the latest data', async () => {
    const { chart } = create()
    await flushNativeUpdates()
    const exporting = chart.exportImage({ format: 'svg' })
    const assertion = expect(exporting).rejects.toMatchObject({ code: 'export-stale' })
    chart.setOption({ data: input(1000) })
    await assertion
    await flushNativeUpdates()
    const worker = ControlledWorker.instances.at(-1)!
    await settleWorker(worker)
    expect(ControlledWorker.instances).toHaveLength(1)
    await expect(chart.exportImage({ format: 'svg' })).resolves.toBeInstanceOf(Blob)
  })

  it('invalidates a sampled request immediately on data replacement and cancels pending export on dispose', async () => {
    const { chart, host } = create()
    const finished = vi.fn()
    const error = vi.fn()
    chart.on('finished', finished)
    chart.on('sampling-error', error)
    await flushNativeUpdates()
    const old = ControlledWorker.instances[0]!
    old.respond()
    await flushNativeUpdates()
    const late = old.onmessage!
    const response = old.repository.handle(old.requests.shift()!)
    chart.setOption({ data: input(1000) })
    expect(old.terminate).not.toHaveBeenCalled()
    late({ data: response })
    await flushNativeUpdates()
    const current = ControlledWorker.instances[0]!
    expect(ControlledWorker.instances).toHaveLength(1)
    await settleWorker(current)
    const path = host.querySelector('.waveform-chart__line')?.getAttribute('d')
    late({ data: response })
    await flushNativeUpdates()
    expect(host.querySelector('.waveform-chart__line')?.getAttribute('d')).toBe(path)
    expect(finished).toHaveBeenCalledOnce()
    expect(error).not.toHaveBeenCalled()
    chart.setViewportDomain([1, 2])
    await flushNativeUpdates()
    const exporting = chart.exportImage({ format: 'svg' })
    const assertion = expect(exporting).rejects.toMatchObject({ code: 'export-cancelled' })
    chart.dispose()
    await assertion
    expect(current.terminate).toHaveBeenCalledOnce()
    expect(host.childElementCount).toBe(0)
  })

  it('rejects stale viewport responses and reaches the latest size/domain through one bounded queue', async () => {
    const { chart } = create()
    const finished = vi.fn()
    chart.on('finished', finished)
    await flushNativeUpdates()
    const worker = ControlledWorker.instances[0]!
    worker.respond()
    await flushNativeUpdates()
    chart.setViewportDomain([1, 2])
    chart.setOption({ width: 360 })
    await flushNativeUpdates()
    worker.respond()
    await flushNativeUpdates()
    expect(finished).not.toHaveBeenCalled()
    expect(worker.requests[0]).toMatchObject({
      type: 'sample-viewport',
      series: [{ xDomain: [1, 2] }],
    })
    worker.respond()
    await flushNativeUpdates()
    expect(finished).toHaveBeenCalledOnce()
    expect(chart.getControlState().targets[0]?.viewport.xDomain).toEqual([1, 2])
  })
})

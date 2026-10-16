import { effectScope, nextTick, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeWaveformSeriesSources } from '@/core/data'
const normalizeWaveformSeries = (data: WaveformData) =>
  normalizeWaveformSeriesSources(data, true).map(({ source, ...series }) => ({
    ...series,
    points: source.pointsInRange(),
  }))
import type { WaveformData } from '@/types'
import {
  createMockWindowLoader,
  selectWaveformWindow,
  waveformRecordMetadata,
  type RemoteWindowLoader,
  type RemoteWindowRequest,
} from '@demo/demo/remoteWaveformLoader'
import { useRemoteWaveformWindow } from '@demo/demo/useRemoteWaveformWindow'

const record: WaveformData = {
  kind: 'series',
  series: ['a', 'b'].map((id) => ({
    id,
    name: id,
    data: { kind: 'samples', startTime: 0, sampleRate: 10, values: [0, 1, 2, 3, 4, 5] },
  })),
}
const scopes: ReturnType<typeof effectScope>[] = []

function setup(loadWindow?: RemoteWindowLoader) {
  const scope = effectScope()
  scopes.push(scope)
  const source = shallowRef(record)
  const resetViewport = vi.fn()
  const remote = scope.run(() => useRemoteWaveformWindow(source, { loadWindow, resetViewport }))!
  return { remote, scope, source, resetViewport }
}

function deferredLoader() {
  const calls: {
    request: RemoteWindowRequest
    signal: AbortSignal
    resolve: (data: WaveformData) => void
    reject: (error: Error) => void
  }[] = []
  const loader: RemoteWindowLoader = (request, signal) =>
    new Promise((resolve, reject) => calls.push({ request, signal, resolve, reject }))
  return { calls, loader }
}

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.useRealTimers()
})

describe('remote window requests', () => {
  it('uses immutable record metadata and handles all normalized input formats', () => {
    expect(waveformRecordMetadata(record).domain).toEqual([0, 0.5])
    expect(waveformRecordMetadata(record).minZoomSpan).toBeCloseTo(0.1)
    const window = selectWaveformWindow(record, { start: 0.1, end: 0.2, seriesIds: ['b'] })
    expect(normalizeWaveformSeries(window).map((series) => series.id)).toEqual(['b'])
    expect(normalizeWaveformSeries(window)[0].points.map((point) => point.x)).toEqual([0.1, 0.2])
    expect(waveformRecordMetadata({ kind: 'points', points: [] })).toEqual({
      domain: [0, 1],
      minZoomSpan: undefined,
    })
    const typed = {
      kind: 'typed-points' as const,
      x: new Float64Array([1, 2]),
      y: new Float64Array([3, 4]),
    }
    expect(selectWaveformWindow(typed, { start: 2, end: 3 })).toEqual({
      kind: 'points',
      points: [{ x: 2, y: 4 }],
    })
    expect(selectWaveformWindow(typed, { start: 1, end: 2 }, true)).toEqual({
      kind: 'points',
      points: [],
    })
  })

  it('cancels at the next intent before its end and rejects stale results even when abort is ignored', async () => {
    const { calls, loader } = deferredLoader()
    const { remote } = setup(loader)
    const old = remote.handleZoomEnd({ start: 0, end: 0.2 })
    remote.handleZoomIntent({ start: 0.2, end: 0.4, gesture: 'wheel' })
    expect(calls[0].signal.aborted).toBe(true)
    calls[0].resolve(record)
    await old
    expect(normalizeWaveformSeries(remote.chartData.value)[0].points).toEqual([])
    const latest = remote.handleZoomEnd({ start: 0.2, end: 0.4 })
    calls[1].resolve(selectWaveformWindow(record, calls[1].request))
    await latest
    expect(normalizeWaveformSeries(remote.chartData.value)[0].points.map((p) => p.x)).toEqual([
      0.2, 0.3, 0.4,
    ])
    expect(remote.recordDomain.value).toEqual([0, 0.5])
    expect(remote.minZoomSpan.value).toBeCloseTo(0.1)
    expect(remote.loading.value).toBe(false)
  })

  it('commits only the newest response when requests finish out of order', async () => {
    const { calls, loader } = deferredLoader()
    const { remote } = setup(loader)
    const first = remote.handleZoomEnd({ start: 0, end: 0.1 })
    const second = remote.handleZoomEnd({ start: 0.3, end: 0.4 })
    calls[1].resolve(selectWaveformWindow(record, calls[1].request))
    await second
    const latest = remote.chartData.value
    calls[0].resolve(record)
    await first
    expect(remote.chartData.value).toBe(latest)
  })

  it('loads all targets of a command independently and merges without losing other series', async () => {
    const { calls, loader } = deferredLoader()
    const { remote } = setup(loader)
    const loads = ['a', 'b'].map((id, index) => {
      const payload = {
        start: index * 0.2,
        end: index * 0.2 + 0.1,
        seriesIds: [id],
        trackIndex: index,
        commandId: 'batch',
        gesture: 'command' as const,
      }
      remote.handleZoomIntent(payload)
      remote.handleZoomChange([payload.start, payload.end])
      return remote.handleZoomEnd(payload)
    })
    await Promise.resolve()
    expect(calls.map((call) => call.signal.aborted)).toEqual([false, false])
    calls[1].resolve(selectWaveformWindow(record, calls[1].request))
    await loads[1]
    expect(remote.loading.value).toBe(true)
    calls[0].resolve(selectWaveformWindow(record, calls[0].request))
    await loads[0]
    expect(
      normalizeWaveformSeries(remote.chartData.value).map((s) => s.points.map((p) => p.x)),
    ).toEqual([
      [0, 0.1],
      [0.2, 0.3],
    ])
    expect(remote.loading.value).toBe(false)
  })

  it('cancels unscoped pan changes and requests only at pan-end', async () => {
    const { calls, loader } = deferredLoader()
    const { remote } = setup(loader)
    const first = remote.handleZoomEnd({ start: 0, end: 0.1, seriesIds: ['a'] })
    remote.handleZoomChange([0.3, 0.4])
    expect(calls[0].signal.aborted).toBe(true)
    expect(calls).toHaveLength(1)
    const pan = remote.handlePanEnd({ start: 0.3, end: 0.4, seriesIds: ['a'] })
    calls[1].resolve(selectWaveformWindow(record, calls[1].request, true))
    await pan
    calls[0].reject(new Error('late failure'))
    await first
    expect(remote.errors.value).toEqual([])
    expect(normalizeWaveformSeries(remote.chartData.value)[0].points).toEqual([])
  })

  it('loads every fit command target even without intent events', async () => {
    const { calls, loader } = deferredLoader()
    const { remote } = setup(loader)
    const loads = ['a', 'b'].map((id) => {
      remote.handleZoomChange([0, 0.5])
      return remote.handleZoomEnd({
        start: 0,
        end: 0.5,
        seriesIds: [id],
        commandId: 'fit-batch',
        action: 'fit',
      })
    })
    await Promise.resolve()
    expect(calls.map((call) => call.signal.aborted)).toEqual([false, false])
    calls.forEach((call) => call.resolve(selectWaveformWindow(record, call.request)))
    await Promise.all(loads)
    expect(
      normalizeWaveformSeries(remote.chartData.value).map((series) => series.points.length),
    ).toEqual([6, 6])
  })

  it('does not start queued commands superseded by another intent or a reset', async () => {
    const { calls, loader } = deferredLoader()
    const { remote } = setup(loader)
    const queued = remote.handleZoomEnd({ start: 0, end: 0.1, commandId: 'old' })
    remote.handleZoomIntent({ start: 0.2, end: 0.3, gesture: 'wheel' })
    await queued
    expect(calls).toHaveLength(0)
    const queuedReset = remote.handleZoomEnd({ start: 0, end: 0.1, commandId: 'old' })
    const reset = remote.resetWaveformViewport()
    await queuedReset
    expect(calls).toHaveLength(1)
    calls[0].resolve(record)
    await reset
  })

  it('retries the failed current target and accepts empty responses', async () => {
    const { calls, loader } = deferredLoader()
    const { remote } = setup(loader)
    const failed = remote.handlePanEnd({ start: 0.2, end: 0.3, seriesIds: ['b'] })
    calls[0].reject(new Error('offline'))
    await failed
    expect(remote.errors.value).toEqual(['offline'])
    const retry = remote.retry()
    expect(calls[1].request).toEqual(calls[0].request)
    calls[1].resolve(selectWaveformWindow(record, calls[1].request, true))
    await retry
    expect(remote.errors.value).toEqual([])
    expect(remote.initialXDomain.value).toEqual([0, 0.5])
  })

  it('resets only the requested series and cancels old results', async () => {
    const { calls, loader } = deferredLoader()
    const { remote, resetViewport } = setup(loader)
    const old = remote.handleZoomEnd({ start: 0.1, end: 0.2, seriesIds: ['a'] })
    const reset = remote.resetWaveformViewport({ seriesIds: ['a'], trackIndex: 2 })
    expect(resetViewport).toHaveBeenCalledWith(2)
    expect(calls[0].signal.aborted).toBe(true)
    expect(calls[1].request).toEqual({ start: 0, end: 0.5, seriesIds: ['a'] })
    calls[1].resolve(selectWaveformWindow(record, calls[1].request))
    await reset
    calls[0].resolve(record)
    await old
    expect(normalizeWaveformSeries(remote.chartData.value)[1].points).toEqual([])
  })

  it('invalidates previous records and prevents commits after disposal', async () => {
    const { calls, loader } = deferredLoader()
    const { remote, source, scope } = setup(loader)
    const old = remote.handleZoomEnd({ start: 0, end: 0.1 })
    source.value = {
      kind: 'points',
      points: [
        { x: 10, y: 1 },
        { x: 11, y: 2 },
      ],
    }
    await nextTick()
    expect(calls[0].signal.aborted).toBe(true)
    expect(calls[1].request).toMatchObject({ start: 10, end: 11 })
    calls[0].resolve(record)
    await old
    expect(remote.recordDomain.value).toEqual([10, 11])
    scope.stop()
    expect(calls[1].signal.aborted).toBe(true)
    const data = remote.chartData.value
    calls[1].resolve(record)
    await Promise.resolve()
    expect(remote.chartData.value).toBe(data)
    await remote.handlePanEnd({ start: 1, end: 2 })
    expect(calls).toHaveLength(2)
  })
})

describe('mock window loader', () => {
  it('uses 80ms by default and preserves source data', async () => {
    vi.useFakeTimers()
    const loader = createMockWindowLoader(() => record)
    const controller = new AbortController()
    const promise = loader({ start: 0.1, end: 0.2 }, controller.signal)
    let completed = false
    void promise.then(() => (completed = true))
    await vi.advanceTimersByTimeAsync(79)
    expect(completed).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(normalizeWaveformSeries(await promise)[0].points).toHaveLength(2)
    expect(normalizeWaveformSeries(record)[0].points).toHaveLength(6)
  })

  it('supports configured empty responses, failures, delays and cancellation', async () => {
    vi.useFakeTimers()
    const request = { start: 0, end: 0.5 }
    const signal = new AbortController().signal
    const empty = createMockWindowLoader(() => record, { empty: () => true, delayMs: () => 5 })(
      request,
      signal,
    )
    await vi.advanceTimersByTimeAsync(5)
    expect(normalizeWaveformSeries(await empty)[0].points).toEqual([])
    const failure = createMockWindowLoader(() => record, { fail: () => true })(request, signal)
    const assertion = expect(failure).rejects.toThrow('模拟数据加载失败')
    await vi.advanceTimersByTimeAsync(80)
    await assertion
    const controller = new AbortController()
    const pending = createMockWindowLoader(() => record)(request, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await expect(
      createMockWindowLoader(() => record)(request, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(vi.getTimerCount()).toBe(0)
  })
})

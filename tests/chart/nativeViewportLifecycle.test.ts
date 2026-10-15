import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountLegacySizedChart as mountSizedChart } from '../support/waveformChart'
import { flushNativeUpdates } from '../support/nativeChart'
import { init } from '@/chart/init'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformChartHandle } from '@/types/controls'
import type { WaveformData } from '@/types/data'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.useRealTimers()
})
const windowData = (start = 10, count = 101, ids = ['a', 'b']): WaveformData => ({
  kind: 'series',
  series: ids.map((id, index) => ({
    id,
    name: id,
    data: {
      kind: 'points',
      points: Array.from({ length: count }, (_, n) => ({ x: start + n / 10, y: n + index })),
    },
  })),
})
function comparable(value: unknown): unknown {
  if (typeof value === 'number') return Number(value.toPrecision(13))
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparable(item)]))
  return value
}
async function pair(options: WaveformChartOptions = {}, input = windowData()) {
  const props = {
    data: input,
    width: 800,
    height: 360,
    animationEnabled: false,
    timeUnit: 's' as const,
    xDomainStrategy: { type: 'data' as const },
    rendering: { sampling: { mode: 'raw' as const } },
    ...options,
  }
  const vue = await mountSizedChart(props.data, props)
  const host = document.createElement('div')
  document.body.append(host)
  Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
  const chart = init(host, props, { autoResize: false })
  cleanup.push(() => {
    chart.dispose()
    host.remove()
    vue.unmount()
  })
  await flushNativeUpdates()
  return { chart, vue, host, old: vue.vm as WaveformChartHandle }
}
function overlay(root: Element, index = 0) {
  const node = root.querySelectorAll<SVGRectElement>('.waveform-chart__overlay')[index]
  const width = Number(node.getAttribute('width')),
    height = Number(node.getAttribute('height'))
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width, height }),
  })
  return { node, width, height }
}
function wheel(target: ReturnType<typeof overlay>, deltaY = -100) {
  target.node.dispatchEvent(
    new WheelEvent('wheel', {
      clientX: target.width / 2,
      clientY: target.height / 2,
      deltaY,
      bubbles: true,
      cancelable: true,
    }),
  )
}
function pointer(target: ReturnType<typeof overlay>, type: string, ratio: number) {
  const event = new MouseEvent(type, {
    clientX: target.width * ratio,
    clientY: target.height / 4,
    button: 0,
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'pointerId', { value: 11 })
  target.node.dispatchEvent(event)
}
async function update(h: Awaited<ReturnType<typeof pair>>, data: WaveformData) {
  h.chart.setOption({ data })
  await h.vue.setProps({ data })
  await flushPromises()
  await flushNativeUpdates()
}
function parity(h: Awaited<ReturnType<typeof pair>>) {
  expect(comparable(h.chart.getControlState())).toEqual(comparable(h.old.getControlState()))
}

describe('native data viewport restoration', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'keeps an integer-aligned raw viewport when display units change (%s)',
    async (displayMode) => {
      const h = await pair({ displayMode, integerZoom: true, timeUnit: 'ms', panXDomain: [0, 100] })
      for (const chart of [h.chart, h.old]) chart.setViewportDomain([12.123, 14.567])
      await flushNativeUpdates()
      const before = comparable(
        h.chart.getControlState().targets.map((target) => target.viewport.xDomain),
      )
      const changes = vi.fn()
      h.chart.on('zoom-change', changes)
      h.chart.setOption({ timeUnit: 's' })
      await h.vue.setProps({ timeUnit: 's' })
      await flushNativeUpdates()
      expect(
        comparable(h.chart.getControlState().targets.map((target) => target.viewport.xDomain)),
      ).toEqual(before)
      expect(
        comparable(h.old.getControlState().targets.map((target) => target.viewport.xDomain)),
      ).toEqual(before)
      expect(changes).not.toHaveBeenCalled()
    },
  )
  it('clears fit boundaries after initial-domain and visibility changes', async () => {
    const h = await pair({ initialXDomain: [12, 18] })
    for (const chart of [h.chart, h.old]) {
      chart.fitToData()
      chart.setViewportDomain([11, 14], {})
    }
    h.chart.setOption({ initialXDomain: [13, 17] })
    await h.vue.setProps({ initialXDomain: [13, 17] })
    await flushNativeUpdates()
    parity(h)
    for (const chart of [h.chart, h.old]) chart.fitToData()
    h.chart.setOption({ hiddenSeriesIds: ['a'] })
    await h.vue.setProps({ hiddenSeriesIds: ['a'] })
    await flushNativeUpdates()
    parity(h)
    for (const chart of [h.chart, h.old]) chart.zoomOut()
    parity(h)
  })

  it('preserves a fitted full interval when configured bounds are wider', async () => {
    const h = await pair({ initialXDomain: [5, 25] })
    for (const chart of [h.chart, h.old]) chart.fitToData()
    await update(h, windowData())
    parity(h)
    expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([10, 20])
  })

  it('keeps an independent track named shared distinct from the aggregate original domain', async () => {
    const input: WaveformData = {
      kind: 'series',
      series: [
        {
          id: 'shared',
          name: 'shared',
          data: {
            kind: 'points',
            points: [
              { x: 10, y: 0 },
              { x: 20, y: 1 },
            ],
          },
        },
        {
          id: 'other',
          name: 'other',
          data: {
            kind: 'points',
            points: [
              { x: 100, y: 0 },
              { x: 200, y: 1 },
            ],
          },
        },
      ],
    }
    const h = await pair({}, input)
    for (const chart of [h.chart, h.old]) chart.zoomIn({ trackId: 'shared' })
    parity(h)
    await update(h, { ...input, series: [...input.series].reverse() })
    parity(h)
    const target = h.chart.getControlState().targets.find((target) => target.trackId === 'shared')!
    expect(target.viewport.xDomain).toEqual([12.5, 17.5])
  })
  it.each(['independent', 'separated', 'compact'] as const)(
    'retains unloaded remote windows through sparse/empty data and raw-second display changes (%s)',
    async (displayMode) => {
      const h = await pair({
        displayMode,
        panXDomain: [0, 100],
        minVisiblePoints: 0,
        minZoomSpan: 0.01,
        maxZoomScale: null,
        pannable: true,
        interactionMode: 'pan',
      })
      for (const chart of [h.chart, h.old]) chart.setViewportDomain([18, 20])
      await flushNativeUpdates()
      const ends: unknown[] = []
      h.chart.on('pan-end', (payload) => ends.push(payload))
      for (const target of [overlay(h.host), overlay(h.vue.element)]) {
        pointer(target, 'pointerdown', 1)
        pointer(target, 'pointerup', 0)
      }
      await flushNativeUpdates()
      parity(h)
      expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([20, 22])
      expect(ends).toHaveLength(1)
      for (const count of [101, 0, 1, 3, 0]) {
        await update(h, windowData(19, count))
        parity(h)
        expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([20, 22])
        expect(h.host.querySelector('.waveform-chart__overlay')).not.toBeNull()
      }
      h.chart.setOption({ width: 360, timeUnit: 'ms', interactionMode: 'zoom' })
      expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([20, 22])
      await flushNativeUpdates()
      wheel(overlay(h.host))
      await flushNativeUpdates()
      expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([20.5, 21.5])
    },
  )

  it('keeps an initially empty remote single-series chart usable and local empty behavior intact', async () => {
    const empty = { kind: 'points' as const, points: [] }
    const remote = await pair(
      { panXDomain: [0, 20], initialXDomain: [0, 10], minZoomSpan: 0.1 },
      empty,
    )
    parity(remote)
    remote.chart.setViewportDomain([12, 14])
    expect(remote.chart.getControlState().targets[0].viewport.xDomain).toEqual([12, 14])
    expect(remote.host.querySelector('.waveform-chart__overlay')).not.toBeNull()
    const local = await pair({}, empty)
    parity(local)
    expect(local.chart.getControlState().targets).toEqual([])
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'retains zoomed series through reordering and rapid references without extra events (%s)',
    async (displayMode) => {
      const h = await pair({ displayMode })
      for (const chart of [h.chart, h.old]) chart.setViewportDomain([12, 14], 0)
      const changes = vi.fn()
      h.chart.on('zoom-change', changes)
      await update(h, windowData(11, 101, ['b', 'a']))
      parity(h)
      h.chart.setOption({ data: windowData(11.1, 101, ['a', 'b']) })
      const final = windowData(11.2, 101, ['b', 'a'])
      h.chart.setOption({ data: final })
      await h.vue.setProps({ data: final })
      await flushNativeUpdates()
      parity(h)
      const target = h.chart
        .getControlState()
        .targets.find((item) => item.trackId === (displayMode === 'independent' ? 'a' : 'shared'))!
      expect(target.viewport.xDomain).toEqual([12, 14])
      expect(changes).not.toHaveBeenCalled()
    },
  )

  it.each(['independent', 'separated', 'compact'] as const)(
    'follows new full-data bounds when there was no zoom or fit (%s)',
    async (displayMode) => {
      const h = await pair({ displayMode })
      await update(h, windowData(30))
      parity(h)
      expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([30, 40])
    },
  )

  it.each(['independent', 'separated', 'compact'] as const)(
    'restores fit windows against original configured bounds and keeps subsequent gestures consistent (%s)',
    async (displayMode) => {
      const h = await pair({ displayMode, initialXDomain: [12, 18] })
      for (const chart of [h.chart, h.old]) chart.fitToData()
      await update(h, windowData(9))
      parity(h)
      const before = h.chart.getControlState().targets[0].viewport.xDomain
      expect(before).toEqual([12, 18])
      for (const target of [overlay(h.host), overlay(h.vue.element)]) wheel(target)
      await flushNativeUpdates()
      await flushPromises()
      parity(h)
      expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([13.5, 16.5])
    },
  )
})

describe('native pending wheel rebind', () => {
  it('resolves each wheel end against the current order after a previous end callback rebinds data', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const h = await pair(),
      ends: unknown[] = []
    h.chart.on('zoom-end', (payload) => {
      ends.push(payload)
      if (ends.length === 1) h.chart.setOption({ data: windowData(11, 101, ['b', 'a']) })
    })
    wheel(overlay(h.host, 0))
    wheel(overlay(h.host, 1))
    await flushNativeUpdates()
    await vi.advanceTimersByTimeAsync(200)
    expect(ends).toEqual([
      expect.objectContaining({ trackIndex: 0, seriesIds: ['a'] }),
      expect.objectContaining({ trackIndex: 0, seriesIds: ['b'] }),
    ])
  })
  it('commits all pending tracks before a change callback rebinds data and never overwrites restored windows', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const h = await pair()
    const ends: unknown[] = []
    let replaced = false
    h.chart.on('zoom-change', () => {
      if (replaced) return
      replaced = true
      h.chart.setOption({ data: windowData(100, 101, ['b', 'a']) })
    })
    h.chart.on('zoom-end', (payload) => ends.push(payload))
    wheel(overlay(h.host, 0))
    wheel(overlay(h.host, 1))
    await flushNativeUpdates()
    for (const target of h.chart.getControlState().targets) {
      expect(target.viewport.xDomain[0]).toBeGreaterThanOrEqual(100)
      expect(target.viewport.xDomain[1]).toBeLessThanOrEqual(110)
    }
    await vi.advanceTimersByTimeAsync(200)
    expect(ends).toHaveLength(2)
    expect(ends).toEqual([
      expect.objectContaining({ trackIndex: 1, seriesIds: ['a'], gesture: 'wheel' }),
      expect.objectContaining({ trackIndex: 0, seriesIds: ['b'], gesture: 'wheel' }),
    ])
  })
  it.each(['independent', 'separated', 'compact'] as const)(
    'keeps one end and current identity after immediate intent-driven loading/reordering (%s)',
    async (displayMode) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const h = await pair(
        { displayMode, initialXDomain: [0, 100], grid: { rowCount: 1, columnCount: 2 } },
        windowData(0, 1001),
      )
      const changes: unknown[] = [],
        ends: unknown[] = []
      h.chart.on('zoom-change', (domain) => changes.push(domain))
      h.chart.on('zoom-end', (payload) => ends.push(payload))
      h.chart.on('zoom-intent', () => h.chart.setOption({ data: windowData(40, 201, ['b', 'a']) }))
      wheel(overlay(h.host))
      await flushNativeUpdates()
      await vi.advanceTimersByTimeAsync(199)
      expect(ends).toEqual([])
      await vi.advanceTimersByTimeAsync(1)
      expect(ends).toHaveLength(1)
      expect(changes).toHaveLength(1)
      expect(ends[0]).toMatchObject({
        start: 25,
        end: 75,
        gesture: 'wheel',
        ...(displayMode === 'independent' ? { trackIndex: 1, seriesIds: ['a'] } : {}),
      })
      expect(
        h.chart
          .getControlState()
          .targets.find((item) => item.trackId === (displayMode === 'independent' ? 'a' : 'shared'))
          ?.viewport.xDomain,
      ).toEqual([25, 75])
    },
  )

  it('keeps the wheel burst through a second loading callback and ends once at the latest range', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const h = await pair(
      { displayMode: 'separated', initialXDomain: [0, 100] },
      windowData(0, 1001),
    )
    const ends = vi.fn(),
      intents = vi.fn()
    h.chart.on('zoom-end', ends)
    h.chart.on('zoom-intent', () => {
      intents()
      h.chart.setOption({ data: windowData(40, 201) })
    })
    wheel(overlay(h.host))
    await flushNativeUpdates()
    wheel(overlay(h.host), 100)
    await flushNativeUpdates()
    await vi.advanceTimersByTimeAsync(200)
    expect(intents).toHaveBeenCalledTimes(2)
    expect(ends).toHaveBeenCalledTimes(1)
    expect(ends).toHaveBeenCalledWith(expect.objectContaining({ start: 0, end: 100 }))
  })

  it.each(['page', 'mode', 'resize', 'dispose'] as const)(
    'cancels stale wheel on %s',
    async (action) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const h = await pair({ grid: { rowCount: 1, columnCount: 1 } })
      const ends = vi.fn()
      h.chart.on('zoom-end', ends)
      wheel(overlay(h.host))
      if (action === 'page')
        h.host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.click()
      if (action === 'mode') h.chart.setInteractionMode('none')
      if (action === 'resize') h.chart.setOption({ width: 360 })
      if (action === 'dispose') h.chart.dispose()
      await flushNativeUpdates()
      await vi.advanceTimersByTimeAsync(200)
      expect(ends).not.toHaveBeenCalled()
    },
  )

  it.each(['zoom', 'pan'] as const)(
    'releases captured %s drags on lifecycle changes without a late jump/end',
    async (interactionMode) => {
      for (const action of ['page', 'mode', 'capability', 'data', 'resize', 'dispose'] as const) {
        const h = await pair({
          interactionMode,
          pannable: true,
          grid: { rowCount: 1, columnCount: 1 },
        })
        h.chart.setViewportDomain([12, 16], 0)
        await flushNativeUpdates()
        const ends = vi.fn(),
          target = overlay(h.host),
          release = vi.fn()
        h.chart.on('zoom-end', ends)
        h.chart.on('pan-end', ends)
        target.node.setPointerCapture = vi.fn()
        target.node.releasePointerCapture = release
        pointer(target, 'pointerdown', 0.25)
        pointer(target, 'pointermove', 0.5)
        if (action === 'page')
          h.host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.click()
        if (action === 'mode') h.chart.setInteractionMode('none')
        if (action === 'capability') h.chart.setOption({ zoomable: false, pannable: false })
        if (action === 'data') h.chart.setOption({ data: windowData(11) })
        if (action === 'resize') h.chart.setOption({ width: 360 })
        if (action === 'dispose') h.chart.dispose()
        const after = action !== 'dispose' ? h.chart.getControlState() : null
        pointer(target, 'pointerup', 0.75)
        await flushNativeUpdates()
        expect(release).toHaveBeenCalledOnce()
        expect(ends).not.toHaveBeenCalled()
        if (after) expect(h.chart.getControlState()).toEqual(after)
      }
    },
  )
})

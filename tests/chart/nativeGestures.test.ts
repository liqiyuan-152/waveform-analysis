import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountLegacySizedChart as mountSizedChart } from '../support/waveformChart'
import { flushNativeUpdates } from '../support/nativeChart'
import { init } from '@/chart/init'
import type { WaveformChartInstance, WaveformChartEvents } from '@/types/native'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformChartHandle } from '@/types/controls'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.useRealTimers()
})
const data = {
  kind: 'series' as const,
  series: ['a', 'b'].map((id, i) => ({
    id,
    name: id,
    data: {
      kind: 'points' as const,
      points: Array.from({ length: 101 }, (_, x) => ({ x: x / 10, y: ((i + 1) * x) / 10 })),
    },
  })),
}
const gestureEvents = ['zoom-intent', 'zoom-change', 'zoom-end', 'pan-end'] as const
function capture(chart: WaveformChartInstance) {
  const values: Record<string, unknown[][]> = {}
  for (const name of gestureEvents)
    chart.on(name, (...args: WaveformChartEvents[typeof name]) => {
      ;(values[name] ??= []).push(args)
    })
  return values
}
function comparable(value: unknown): unknown {
  if (typeof value === 'number') return Number(value.toPrecision(13))
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparable(item)]))
  return value
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
function wheel(target: ReturnType<typeof overlay>, deltaY = -1, ratio = 0.5) {
  const event = new WheelEvent('wheel', {
    clientX: target.width * ratio,
    clientY: target.height / 2,
    deltaY,
    bubbles: true,
    cancelable: true,
  })
  target.node.dispatchEvent(event)
  return event
}
function pointer(target: ReturnType<typeof overlay>, type: string, ratio: number, id = 7) {
  const event = new MouseEvent(type, {
    clientX: target.width * ratio,
    clientY: target.height / 2,
    button: 0,
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'pointerId', { value: id })
  target.node.dispatchEvent(event)
  return event
}
async function native(options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
  document.body.append(host)
  const chart = init(
    host,
    {
      data,
      width: 800,
      height: 360,
      animationEnabled: false,
      xDomainStrategy: { type: 'data' },
      rendering: { sampling: { mode: 'raw' } },
      ...options,
    },
    { autoResize: false },
  )
  cleanup.push(() => {
    chart.dispose()
    host.remove()
  })
  await flushNativeUpdates()
  return { host, chart, root: host.querySelector<HTMLElement>('.waveform-native-chart')! }
}
async function pair(options: WaveformChartOptions = {}) {
  const h = await native(options)
  const vue = await mountSizedChart(data, {
    width: 800,
    height: 360,
    animationEnabled: false,
    xDomainStrategy: { type: 'data' },
    rendering: { sampling: { mode: 'raw' } },
    ...options,
  })
  cleanup.push(() => vue.unmount())
  return { ...h, vue, old: vue.vm as WaveformChartHandle }
}

describe('native gesture compatibility', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'matches Vue wheel burst state and complete event tuples in %s',
    async (displayMode) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const h = await pair({ displayMode })
      const values = capture(h.chart)
      const actual = overlay(h.host),
        expected = overlay(h.vue.element)
      for (const target of [actual, expected]) {
        wheel(target, -1, 0.3)
        wheel(target, -1000, 0.3)
      }
      expect(values['zoom-change']).toBeUndefined()
      await flushNativeUpdates()
      await vi.advanceTimersByTimeAsync(199)
      expect(values['zoom-end']).toBeUndefined()
      await vi.advanceTimersByTimeAsync(1)
      expect(comparable(h.chart.getControlState())).toEqual(comparable(h.old.getControlState()))
      for (const name of gestureEvents)
        expect(comparable(values[name])).toEqual(comparable(h.vue.emitted(name)))
      expect(values['zoom-change']).toHaveLength(1)
      expect(values['zoom-end']).toHaveLength(1)
      expect(actual.node).toBe(overlay(h.host).node)
    },
  )

  it.each(['independent', 'separated', 'compact'] as const)(
    'matches Vue X-only box zoom in %s',
    async (displayMode) => {
      const h = await pair({ displayMode })
      const values = capture(h.chart)
      for (const target of [overlay(h.host), overlay(h.vue.element)]) {
        pointer(target, 'pointerdown', 0.25)
        pointer(target, 'pointermove', 0.75)
        pointer(target, 'pointerup', 0.75)
      }
      await flushNativeUpdates()
      expect(comparable(h.chart.getControlState())).toEqual(comparable(h.old.getControlState()))
      for (const name of gestureEvents)
        expect(comparable(values[name])).toEqual(comparable(h.vue.emitted(name)))
      expect(
        h.host.querySelector<SVGElement>('.waveform-chart__zoom-selection')?.style.display,
      ).toBe('none')
    },
  )

  it.each([
    { integerZoom: true },
    { minZoomSpan: 2 },
    { minVisiblePoints: 30 },
    { maxZoomScale: 2 },
  ])('matches Vue wheel and box constraints %j', async (options) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const h = await pair(options)
    const values = capture(h.chart)
    for (const target of [overlay(h.host), overlay(h.vue.element)]) wheel(target, -1, 0.9)
    await flushNativeUpdates()
    await vi.advanceTimersByTimeAsync(200)
    for (const target of [overlay(h.host), overlay(h.vue.element)]) {
      pointer(target, 'pointerdown', 0.4)
      pointer(target, 'pointerup', 0.5)
    }
    await flushNativeUpdates()
    expect(comparable(h.chart.getControlState())).toEqual(comparable(h.old.getControlState()))
    for (const name of gestureEvents)
      expect(comparable(values[name])).toEqual(comparable(h.vue.emitted(name)))
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'matches Vue pan mode and end payload in %s',
    async (displayMode) => {
      const h = await pair({
        displayMode,
        pannable: true,
        interactionMode: 'pan',
        yDomain: [0, 20],
      })
      for (const chart of [h.chart, h.old]) chart.setViewportDomain([2, 6], 0)
      await flushNativeUpdates()
      const values = capture(h.chart)
      for (const target of [overlay(h.host), overlay(h.vue.element)]) {
        pointer(target, 'pointerdown', 0.5)
        pointer(target, 'pointermove', 0.6)
        pointer(target, 'pointerup', 0.6)
      }
      await flushNativeUpdates()
      expect(comparable(h.chart.getControlState())).toEqual(comparable(h.old.getControlState()))
      for (const name of gestureEvents)
        expect(comparable(values[name])).toEqual(comparable(h.vue.emitted(name)))
    },
  )
})

describe('native input ownership and cancellation', () => {
  it.each([{ zoomable: false }, { presentationMode: true }, { interactionMode: 'none' as const }])(
    'ignores disabled zoom gestures %j',
    async (options) => {
      const h = await native(options),
        before = h.chart.getControlState(),
        values = capture(h.chart)
      const target = overlay(h.host)
      expect(wheel(target).defaultPrevented).toBe(false)
      pointer(target, 'pointerdown', 0.25)
      pointer(target, 'pointerup', 0.75)
      await flushNativeUpdates()
      expect(h.chart.getControlState()).toEqual(before)
      expect(values).toEqual({})
    },
  )

  it('uses Space only inside the active chart and excludes editable controls', async () => {
    const h = await native({ pannable: true }),
      other = await native({ pannable: true })
    h.chart.setViewportDomain([2, 6], 0)
    await flushNativeUpdates()
    h.root.dispatchEvent(new Event('pointerenter'))
    const input = document.createElement('input')
    h.root.append(input)
    const editableSpace = new KeyboardEvent('keydown', {
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(editableSpace)
    expect(editableSpace.defaultPrevented).toBe(false)
    const space = new KeyboardEvent('keydown', { code: 'Space', cancelable: true })
    window.dispatchEvent(space)
    expect(space.defaultPrevented).toBe(true)
    const target = overlay(h.host)
    pointer(target, 'pointerdown', 0.5)
    expect(h.root.classList.contains('waveform-chart--panning')).toBe(true)
    pointer(target, 'pointermove', 0.6)
    pointer(target, 'pointerup', 0.6)
    expect(comparable(h.chart.getControlState().targets[0].viewport.xDomain)).toEqual([1.6, 5.6])
    const inactive = overlay(other.host)
    pointer(inactive, 'pointerdown', 0.25)
    pointer(inactive, 'pointermove', 0.75)
    expect(other.root.classList.contains('waveform-chart--panning')).toBe(false)
    expect(
      other.root.querySelector<SVGElement>('.waveform-chart__zoom-selection')?.style.display,
    ).toBe('')
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
  })

  it('releases capture, ignores other pointers and cancels without terminal events', async () => {
    const h = await native(),
      values = capture(h.chart),
      target = overlay(h.host)
    const release = vi.fn(),
      capturePointer = vi.fn()
    target.node.setPointerCapture = capturePointer
    target.node.releasePointerCapture = release
    pointer(target, 'pointerdown', 0.25)
    pointer(target, 'pointerup', 0.75, 8)
    expect(release).not.toHaveBeenCalled()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(capturePointer).toHaveBeenCalledWith(7)
    expect(release).toHaveBeenCalledWith(7)
    pointer(target, 'pointerup', 0.75)
    expect(values).toEqual({})
    pointer(target, 'pointerdown', 0.25)
    pointer(target, 'pointerup', 0.75)
    expect(release).toHaveBeenCalledTimes(2)
    expect(values['zoom-end']).toHaveLength(1)
  })

  it.each(['option', 'command', 'dispose'] as const)(
    'cancels pending wheel on %s',
    async (action) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const h = await native(),
        values = capture(h.chart)
      wheel(overlay(h.host))
      if (action === 'option') h.chart.setOption({ interactionMode: 'none' })
      if (action === 'command') h.chart.resetViewport()
      if (action === 'dispose') h.chart.dispose()
      await flushNativeUpdates()
      await vi.advanceTimersByTimeAsync(300)
      expect(values['zoom-change']).toBeUndefined()
      expect(values['zoom-end']).toBeUndefined()
    },
  )

  it('stops pending commits when an intent callback replaces data', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const h = await native(),
      values = capture(h.chart)
    h.chart.on('zoom-intent', () =>
      h.chart.setOption({
        data: {
          kind: 'points',
          points: [
            { x: 20, y: 0 },
            { x: 40, y: 1 },
          ],
        },
      }),
    )
    wheel(overlay(h.host))
    await flushNativeUpdates()
    await vi.advanceTimersByTimeAsync(300)
    expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([20, 40])
    expect(values['zoom-change']).toBeUndefined()
    expect(values['zoom-end']).toBeUndefined()
  })
})

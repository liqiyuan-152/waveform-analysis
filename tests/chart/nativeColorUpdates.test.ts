import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WaveformChart from '@/adapters/vue/WaveformChart.vue'
import { init, getInstanceByDom } from '@/chart/init'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { flushNativeUpdates } from '../support/nativeChart'
import { flushAnimationFrames } from '../support/setup'
import type { WaveformChartOptions, WaveformChartOptionUpdate } from '@/types/options'

const dispose: Array<() => void> = []
afterEach(() => {
  dispose.splice(0).forEach((fn) => fn())
  vi.restoreAllMocks()
  vi.useRealTimers()
})
const data = {
  kind: 'points' as const,
  points: Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: i % 7 })),
}
async function setup(vue: boolean, options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
  const props = {
    width: 800,
    height: 400,
    data,
    animationEnabled: false,
    xDomainStrategy: { type: 'data' as const },
    rendering: { sampling: { mode: 'raw' as const } },
    ...options,
  }
  const wrapper = vue ? mount(WaveformChart, { attachTo: host, props }) : undefined
  const chart = wrapper
    ? getInstanceByDom(wrapper.element)!
    : init(host, props, { autoResize: false })
  if (wrapper) {
    Object.defineProperty(wrapper.element, 'getClientRects', { value: () => [{}] })
    chart.resize()
  }
  dispose.push(() => {
    if (wrapper) wrapper.unmount()
    else chart.dispose()
    host.remove()
  })
  const patch = async (value: WaveformChartOptionUpdate) => {
    if (wrapper) await wrapper.setProps(value)
    else chart.setOption(value)
  }
  await flushNativeUpdates()
  const node = host.querySelector<SVGRectElement>('.waveform-chart__overlay')!
  const width = Number(node.getAttribute('width')),
    height = Number(node.getAttribute('height'))
  Object.defineProperty(node, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width, height }),
  })
  const pointer = (type: string, ratio: number) => {
    const event = new MouseEvent(type, {
      clientX: ratio * width,
      clientY: height / 2,
      button: 0,
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(event, 'pointerId', { value: 7 })
    node.dispatchEvent(event)
  }
  const wheel = () =>
    node.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: width / 2,
        clientY: height / 2,
        deltaY: -1,
        bubbles: true,
        cancelable: true,
      }),
    )
  return { host, chart, patch, pointer, wheel, node }
}

describe.each([false, true])('color-only updates through Vue=%s', (vue) => {
  it('reuses layout and sampling, invalidates old export, and ignores effective no-ops', async () => {
    const h = await setup(vue)
    const calculate = vi.spyOn(ChartLayoutEngine.prototype, 'calculate')
    const rendered = vi.fn(),
      finished = vi.fn()
    h.chart.on('rendered', rendered)
    h.chart.on('finished', finished)
    const oldExport = h.chart.exportImage({ format: 'svg' })
    const stale = expect(oldExport).rejects.toMatchObject({ code: 'export-stale' })
    await h.patch({ lineColor: 'red', width: 800 })
    await stale
    await flushNativeUpdates()
    expect(calculate).not.toHaveBeenCalled()
    expect(h.host.querySelector('.waveform-chart__line')?.getAttribute('stroke')).toBe('red')
    expect(finished).toHaveBeenCalledOnce()
    const revision = rendered.mock.calls.at(-1)![0].revision
    await h.patch({ lineColor: 'red' })
    await flushNativeUpdates()
    expect(rendered.mock.calls.at(-1)![0].revision).toBe(revision)
    await h.patch({ lineColor: 'blue', width: 900 })
    await flushNativeUpdates()
    expect(calculate).toHaveBeenCalled()
    expect(h.host.querySelector('svg.waveform-chart__svg')?.getAttribute('width')).toBe('900')
  })

  it.each(['zoom', 'pan'] as const)(
    'preserves an active %s pointer and its event payloads',
    async (mode) => {
      const control = await setup(vue, { pannable: true, interactionMode: mode })
      const actual = await setup(vue, { pannable: true, interactionMode: mode })
      for (const h of [control, actual]) h.chart.setViewportDomain([2, 8], 0)
      await flushNativeUpdates()
      const before: unknown[] = [],
        after: unknown[] = []
      control.chart.on(mode === 'zoom' ? 'zoom-end' : 'pan-end', (value) => before.push(value))
      actual.chart.on(mode === 'zoom' ? 'zoom-end' : 'pan-end', (value) => after.push(value))
      const release = vi.fn()
      actual.node.setPointerCapture = vi.fn()
      actual.node.releasePointerCapture = release
      for (const h of [control, actual]) {
        h.pointer('pointerdown', 0.3)
        h.pointer('pointermove', 0.5)
      }
      await actual.patch({ lineColor: 'red' })
      await flushNativeUpdates()
      expect(release).not.toHaveBeenCalled()
      for (const h of [control, actual]) {
        h.pointer('pointermove', 0.65)
        h.pointer('pointerup', 0.65)
      }
      await flushNativeUpdates()
      expect(actual.chart.getControlState()).toEqual(control.chart.getControlState())
      expect(after).toEqual(before)
      expect(after).toHaveLength(1)
    },
  )

  it.each(['pending-frame', 'debounce'] as const)(
    'preserves wheel %s and its original deadline',
    async (phase) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const control = await setup(vue),
        actual = await setup(vue)
      const before: unknown[] = [],
        after: unknown[] = []
      control.chart.on('zoom-end', (value) => before.push(value))
      actual.chart.on('zoom-end', (value) => after.push(value))
      control.wheel()
      actual.wheel()
      if (phase === 'debounce') {
        await flushNativeUpdates()
        await vi.advanceTimersByTimeAsync(100)
      }
      await actual.patch({ lineColor: 'red' })
      await flushNativeUpdates()
      await vi.advanceTimersByTimeAsync(phase === 'debounce' ? 100 : 200)
      expect(after).toEqual(before)
      expect(after).toHaveLength(1)
      expect(actual.chart.getControlState()).toEqual(control.chart.getControlState())
    },
  )

  it.each(['edit', 'draft'] as const)('keeps annotation %s, focus and selection', async (mode) => {
    const h = await setup(vue, {
      annotations: [{ id: 'note', seriesId: 'series-0', x: 1, y: 3, text: 'original' }],
    })
    if (mode === 'draft') {
      await h.patch({ interactionMode: 'annotation' })
      await flushNativeUpdates()
      h.node.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 60 }))
    } else {
      h.host
        .querySelector('.waveform-annotation')!
        .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 100 }))
      h.host.querySelector<HTMLButtonElement>('.waveform-annotation-context-menu button')!.click()
    }
    const text = document.querySelector<HTMLTextAreaElement>('dialog textarea')!
    text.value = 'unsaved draft'
    text.dispatchEvent(new Event('input', { bubbles: true }))
    text.focus()
    text.setSelectionRange(2, 5)
    const changes = vi.fn()
    h.chart.on('annotation-update', changes)
    h.chart.on('annotation-create', changes)
    await h.patch({ lineColor: 'red' })
    await flushNativeUpdates()
    expect(document.activeElement).toBe(text)
    expect(text.value).toBe('unsaved draft')
    expect([text.selectionStart, text.selectionEnd]).toEqual([2, 5])
    expect(changes).not.toHaveBeenCalled()
  })
  it('preserves an annotation drag and commits its final offset once', async () => {
    const h = await setup(vue, {
      annotations: [{ id: 'note', seriesId: 'series-0', x: 1, y: 3, text: 'drag' }],
    })
    const label = h.host.querySelector<SVGGElement>('.waveform-annotation')!
    const request = vi.fn()
    h.chart.on('update:annotations', request)
    const pointer = (target: EventTarget, type: string, x: number, y: number) =>
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y }),
      )
    pointer(label, 'pointerdown', 100, 100)
    pointer(window, 'pointermove', 120, 110)
    await h.patch({ lineColor: 'red' })
    await flushNativeUpdates()
    expect(request).not.toHaveBeenCalled()
    pointer(window, 'pointerup', 130, 120)
    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0]![0][0]).toMatchObject({ labelOffsetX: 30, labelOffsetY: 20 })
  })
})

describe('color update during native entrance animation', () => {
  it.each([false, true])(
    'preserves the timeline and latest revision through Vue=%s',
    async (vue) => {
      let now = 0
      vi.spyOn(performance, 'now').mockImplementation(() => now)
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
      const host = document.createElement('div')
      document.body.append(host)
      Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
      const complete = vi.fn(),
        aborted = vi.fn()
      const options = {
        width: 800,
        height: 400,
        data,
        animation: {
          duration: 1000,
          easing: 'linear' as const,
          onComplete: complete,
          onAbort: aborted,
        },
        rendering: { sampling: { mode: 'raw' as const } },
      }
      const wrapper = vue ? mount(WaveformChart, { attachTo: host, props: options }) : undefined
      const chart = wrapper
        ? getInstanceByDom(wrapper.element)!
        : init(host, options, { autoResize: false })
      if (wrapper) {
        Object.defineProperty(wrapper.element, 'getClientRects', { value: () => [{}] })
        chart.resize()
      }
      dispose.push(() => {
        if (wrapper) wrapper.unmount()
        else chart.dispose()
        host.remove()
      })
      const finished = vi.fn()
      chart.on('finished', finished)
      const frame = async (time: number) => {
        now = time
        for (let i = 0; i < 6; i++) {
          flushAnimationFrames(now)
          await Promise.resolve()
        }
      }
      await frame(0)
      await frame(400)
      const width = host.querySelector('clipPath rect')?.getAttribute('width')
      if (wrapper) await wrapper.setProps({ lineColor: 'red' })
      else chart.setOption({ lineColor: 'red' })
      await frame(400)
      expect(host.querySelector('clipPath rect')?.getAttribute('width')).toBe(width)
      expect(host.querySelector('.waveform-chart__line')?.getAttribute('stroke')).toBe('red')
      expect(finished).not.toHaveBeenCalled()
      expect(complete).not.toHaveBeenCalled()
      await frame(1000)
      expect(complete).toHaveBeenCalledOnce()
      expect(aborted).not.toHaveBeenCalled()
      expect(finished).toHaveBeenCalledOnce()
    },
  )
})

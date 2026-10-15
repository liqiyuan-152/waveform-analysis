import { resizeChart } from '@tests/support/setup'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nextTick } from 'vue'
import { flushVueChartUpdates, gridSeries, mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames } from '@tests/support/setup'
import { observeNativePresentation } from '@tests/support/nativePresentation'
let presentation: ReturnType<typeof observeNativePresentation>
import type { WaveformAnnotation } from '@/index'

let now = 0
const wrappers: Awaited<ReturnType<typeof mountSizedChart>>[] = []
const annotations: WaveformAnnotation[] = [0, 1, 2].map((i) => ({
  id: `note-${i}`,
  seriesId: `channel-${i}`,
  x: 0.5,
  y: i + 0.5,
  text: `note ${i}`,
}))
async function chart(props = {}) {
  const wrapper = await mountSizedChart(gridSeries(3), {
    grid: { rowCount: 1, columnCount: 1 },
    animationAnnotation: { duration: 0 },
    animationEnabled: true,
    rendering: { sampling: { mode: 'raw' } },
    annotations,
    ...props,
    animation: { duration: 0 },
  })
  wrappers.push(wrapper)
  await flushVueChartUpdates()
  await nextTick()
  await wrapper.setProps({ animation: { duration: 1000, easing: 'linear' }, ...props })
  return wrapper
}
async function frame(ms: number) {
  now += ms
  await vi.advanceTimersByTimeAsync(ms)
  flushAnimationFrames(now)
  await nextTick()
  await flushVueChartUpdates()
}
async function page(wrapper: Awaited<ReturnType<typeof chart>>, direction = 'next') {
  await wrapper.get(`[aria-label="${direction === 'next' ? '下一页' : '上一页'}"]`).trigger('click')
  await flushVueChartUpdates()
  await nextTick()
}
const clip = (wrapper: Awaited<ReturnType<typeof chart>>) =>
  wrapper.find('.waveform-track__series-item [clipPathUnits] rect')
const drawingProgress = (wrapper: Awaited<ReturnType<typeof chart>>) => {
  const rect = clip(wrapper)
  if (!rect.exists()) return 1
  const track = presentation.track(wrapper.element)
  return Number(rect.attributes('width')) / track.width
}
const noteOpacity = (wrapper: Awaited<ReturnType<typeof chart>>) =>
  Number(wrapper.get('.waveform-annotation').attributes('opacity'))

beforeEach(() => {
  presentation = observeNativePresentation()
  now = 0
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('pagination entrance replay', () => {
  it('draws the new waveform then releases its annotation with unchanged path geometry', async () => {
    const wrapper = await chart()
    await page(wrapper)
    expect(wrapper.get('.waveform-chart__line').attributes('data-series-id')).toBe('channel-1')
    expect(drawingProgress(wrapper)).toBe(0)
    expect(noteOpacity(wrapper)).toBe(0)
    expect(wrapper.find('[clipPathUnits] rect').exists()).toBe(true) // outer viewport clip remains
    expect(clip(wrapper).exists()).toBe(true)
    expect(wrapper.get('.waveform-track__series-item').attributes('opacity')).toBe('1')
    const axis = wrapper.find('.waveform-chart__track').element
    expect(axis.getAttribute('opacity')).toBeNull()
    const path = wrapper.get('.waveform-chart__line').attributes('d')
    await frame(250)
    expect(drawingProgress(wrapper)).toBeCloseTo(0.5)
    expect(noteOpacity(wrapper)).toBe(0)
    expect(wrapper.get('.waveform-chart__line').attributes('d')).toBe(path)
    await frame(250)
    expect(drawingProgress(wrapper)).toBe(1)
    expect(noteOpacity(wrapper)).toBe(1)
    expect(presentation.getAnimationCount()).toBe(0)
    expect(wrapper.emitted('page-change')).toEqual([[2, 3]])
  })
  it('clips points and error bars with unchanged path geometry', async () => {
    const input = gridSeries(3)
    if (input.kind === 'series')
      input.series.forEach((series) => {
        series.pointType = 'circle'
        series.errorBar = { visible: true }
        if (series.data.kind === 'points')
          series.data.points = series.data.points.map((point) => ({ ...point, error: 0.25 }))
      })
    const wrapper = await chart({ data: input })
    await page(wrapper)
    expect(wrapper.find('.waveform-chart__point').exists()).toBe(true)
    expect(wrapper.find('.waveform-chart__error-bar').exists()).toBe(true)
    const pointPath = wrapper.get('.waveform-chart__point').attributes('d')
    const errorPath = wrapper.get('.waveform-chart__error-bar').attributes('d')
    await frame(250)
    expect(drawingProgress(wrapper)).toBeCloseTo(0.5)
    expect(wrapper.get('.waveform-chart__point').attributes('d')).toBe(pointPath)
    expect(wrapper.get('.waveform-chart__error-bar').attributes('d')).toBe(errorPath)
  })
  it('replaces fast page changes, replays returning pages and ignores same-page clicks', async () => {
    const complete = vi.fn(),
      abort = vi.fn()
    const wrapper = await chart({
      animation: { duration: 1000, easing: 'linear', onComplete: complete, onAbort: abort },
    })
    await page(wrapper)
    await frame(100)
    await page(wrapper)
    expect(abort).toHaveBeenCalledTimes(1)
    expect(drawingProgress(wrapper)).toBe(0)
    expect(wrapper.get('.waveform-chart__line').attributes('data-series-id')).toBe('channel-2')
    await frame(250)
    expect(drawingProgress(wrapper)).toBeCloseTo(0.5)
    await frame(250)
    expect(complete).toHaveBeenCalledTimes(1)
    await page(wrapper, 'prev')
    expect(drawingProgress(wrapper)).toBe(0)
    await frame(100)
    const before = drawingProgress(wrapper)
    await wrapper.get('[aria-current="page"]').trigger('click')
    expect(drawingProgress(wrapper)).toBe(before)
    expect(wrapper.emitted('page-change')).toHaveLength(3)
  })
  it.each([
    { animationEnabled: false },
    { animation: { enabled: false } },
    { animation: { duration: 0 } },
    { animationThreshold: 0 },
    { animationThreshold: 6 },
  ])(
    'shows the new page statically when disabled or below no-animation thresholds: %j',
    async (props) => {
      const wrapper = await chart(props)
      await page(wrapper)
      expect(drawingProgress(wrapper)).toBe(1)
      expect(noteOpacity(wrapper)).toBe(1)
      expect(presentation.getAnimationCount()).toBe(0)
    },
  )
  it('uses the fixed 500ms pagination duration independently of updates', async () => {
    const wrapper = await chart({
      animation: { easing: 'linear' },
      animationUpdate: { enabled: false },
    })
    await page(wrapper)
    await frame(250)
    expect(drawingProgress(wrapper)).toBeCloseTo(0.5)
    await frame(250)
    expect(drawingProgress(wrapper)).toBe(1)
  })
  it('uses 500ms for pagination even when initial/grid duration is customized', async () => {
    const wrapper = await chart({
      animation: { duration: 2000, easing: 'linear', staggerDelay: 0 },
    })
    await page(wrapper)
    await frame(250)
    expect(drawingProgress(wrapper)).toBeCloseTo(0.5)
    await frame(250)
    expect(clip(wrapper).exists()).toBe(false)
    await wrapper.setProps({ grid: { rowCount: 1, columnCount: 2 } })
    await flushVueChartUpdates()
    await frame(500)
    expect(drawingProgress(wrapper)).toBeCloseTo(0.25)
    await frame(1500)
    expect(clip(wrapper).exists()).toBe(false)
  })
  it('lets pagination pointer movement continue but commits before plot interaction', async () => {
    const wrapper = await chart()
    await page(wrapper)
    await frame(100)
    await wrapper.get('[aria-label="下一页"]').trigger('pointermove')
    expect(drawingProgress(wrapper)).toBeCloseTo(0.2)
    wrapper
      .get('.waveform-chart__overlay')
      .element.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 100 }),
      )
    await flushVueChartUpdates()
    expect(drawingProgress(wrapper)).toBe(1)
    expect(noteOpacity(wrapper)).toBe(1)
    expect(presentation.getAnimationCount()).toBe(0)
  })
  it('commits on resize and automatic page reset without replaying', async () => {
    const wrapper = await chart()
    await page(wrapper)
    await frame(100)
    resizeChart(600, 300)
    await flushVueChartUpdates()
    await nextTick()
    expect(drawingProgress(wrapper)).toBe(1)
    await wrapper.setProps({ data: gridSeries(1) })
    await flushVueChartUpdates()
    expect(drawingProgress(wrapper)).toBe(1)
    expect(wrapper.get('.waveform-chart__line').attributes('data-series-id')).toBe('channel-0')
    expect(presentation.getAnimationCount()).toBe(0)
  })
  it('finishes on entrance disable and does not restart when enabled again', async () => {
    const wrapper = await chart()
    await page(wrapper)
    await frame(100)
    await wrapper.setProps({ animation: { enabled: false } })
    expect(drawingProgress(wrapper)).toBe(1)
    await wrapper.setProps({ animation: { enabled: true } })
    expect(drawingProgress(wrapper)).toBe(1)
    expect(presentation.getAnimationCount()).toBe(0)
  })
  it('pauses in the background and exports full geometry while another chart continues', async () => {
    const first = await chart(),
      second = await chart()
    await page(first)
    await frame(100)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await frame(250)
    expect(drawingProgress(first)).toBeCloseTo(0.2)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await frame(150)
    expect(drawingProgress(first)).toBeCloseTo(0.5)
    await page(second)
    const exported = first.vm.exportImage({ format: 'svg' })
    await frame(250)
    await vi.advanceTimersByTimeAsync(16)
    expect((await exported).type).toBe('image/svg+xml')
    expect(drawingProgress(first)).toBe(1)
    expect(drawingProgress(second)).toBeCloseTo(0.5)
    first.unmount()
    second.unmount()
    expect(presentation.getAnimationCount()).toBe(0)
  })
  it('replays a normalized grid change after resetting to the final page, with stagger', async () => {
    const complete = vi.fn()
    const wrapper = await chart({
      animation: { duration: 1000, easing: 'linear', staggerDelay: 100, onComplete: complete },
    })
    await page(wrapper)
    await frame(1000)
    complete.mockClear()
    await wrapper.setProps({ grid: { rowCount: 1, columnCount: 2 } })
    await flushVueChartUpdates()
    expect(
      wrapper.findAll('.waveform-chart__line').map((p) => p.attributes('data-series-id')),
    ).toEqual(['channel-0', 'channel-1'])
    const rects = () => wrapper.findAll('.waveform-track__series-item [clipPathUnits] rect')
    expect(rects()).toHaveLength(2)
    expect(rects().map((r) => Number(r.attributes('width')))).toEqual([0, 0])
    await frame(500)
    expect(Number(rects()[0].attributes('width'))).toBeGreaterThan(
      Number(rects()[1].attributes('width')),
    )
    const widths = rects().map((r) => r.attributes('width'))
    await wrapper.setProps({ grid: { rowCount: 1, columnCount: 2 } })
    expect(rects().map((r) => r.attributes('width'))).toEqual(widths)
    await frame(600)
    expect(rects()).toHaveLength(0)
    expect(complete).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('page-change')).toEqual([
      [2, 3],
      [1, 2],
    ])
  })
  it.each(['right-to-left', 'center-out'] as const)(
    'replays the configured %s direction',
    async (direction) => {
      const wrapper = await chart({ animation: { duration: 1000, easing: 'linear', direction } })
      await page(wrapper)
      expect(Number(clip(wrapper).attributes('x'))).toBeGreaterThan(0)
      await frame(250)
      expect(drawingProgress(wrapper)).toBeCloseTo(0.5)
      await wrapper.setProps({ grid: { rowCount: 2, columnCount: 2 } })
      await flushVueChartUpdates()
      expect(wrapper.findAll('.waveform-track__series-item [clipPathUnits]')).toHaveLength(3)
      await frame(1200)
      expect(clip(wrapper).exists()).toBe(false)
    },
  )
  it('keeps replay running when only data-update animation is disabled', async () => {
    const wrapper = await chart()
    await page(wrapper)
    await frame(100)
    await wrapper.setProps({ animationUpdate: { enabled: false } })
    expect(drawingProgress(wrapper)).toBeCloseTo(0.2)
    await frame(400)
    expect(drawingProgress(wrapper)).toBe(1)
  })
  it('keeps running configuration snapshotted and releases annotations on entrance disable', async () => {
    const wrapper = await chart({
      animationAnnotation: { duration: 300, type: 'fade-in', easing: 'linear' },
    })
    await page(wrapper)
    await frame(100)
    await wrapper.setProps({ animation: { duration: 0, easing: 'linear' } })
    expect(drawingProgress(wrapper)).toBeCloseTo(0.2)
    expect(noteOpacity(wrapper)).toBe(0)
    await frame(100)
    expect(drawingProgress(wrapper)).toBeCloseTo(0.4)
    await wrapper.setProps({ animation: { enabled: false } })
    expect(drawingProgress(wrapper)).toBe(1)
    await frame(150)
    expect(noteOpacity(wrapper)).toBeCloseTo(0.5)
    await frame(150)
    expect(noteOpacity(wrapper)).toBe(1)
    expect(wrapper.emitted('update:annotations')).toBeUndefined()
  })
  it('aborts a grid replay when a newer grid replaces it and draws only the final target', async () => {
    const abort = vi.fn(),
      complete = vi.fn()
    const wrapper = await chart({
      animation: { duration: 1000, easing: 'linear', onAbort: abort, onComplete: complete },
    })
    await wrapper.setProps({ grid: { rowCount: 1, columnCount: 2 } })
    await frame(200)
    await wrapper.setProps({ grid: { rowCount: 2, columnCount: 2 } })
    expect(abort).toHaveBeenCalledTimes(2)
    expect(complete).not.toHaveBeenCalled()
    await frame(1200)
    expect(complete).toHaveBeenCalledTimes(3)
    expect(wrapper.findAll('.waveform-track__series-item [clipPathUnits]')).toHaveLength(0)
  })
  it('replays the final clamped last page when the new grid reduces page count', async () => {
    const wrapper = await chart()
    await page(wrapper)
    await page(wrapper)
    await wrapper.setProps({ grid: { rowCount: 1, columnCount: 2 } })
    await flushVueChartUpdates()
    expect(
      wrapper.findAll('.waveform-chart__line').map((p) => p.attributes('data-series-id')),
    ).toEqual(['channel-2'])
    expect(drawingProgress(wrapper)).toBe(0)
    expect(wrapper.emitted('page-change')?.at(-1)).toEqual([2, 2])
    await frame(1000)
    expect(drawingProgress(wrapper)).toBe(1)
  })
  it('releases annotations even if the completion callback refreshes controlled annotations', async () => {
    const wrapper = await chart({
      animation: {
        duration: 1000,
        easing: 'linear',
        onComplete: () => {
          void wrapper.setProps({ annotations: [...annotations] })
        },
      },
      animationAnnotation: { duration: 300, type: 'fade-in', easing: 'linear' },
    })
    await page(wrapper)
    await frame(1000)
    await frame(150)
    expect(noteOpacity(wrapper)).toBeCloseTo(0.5)
    await frame(150)
    expect(noteOpacity(wrapper)).toBe(1)
  })
  it('respects reduced motion and missing RAF', async () => {
    vi.spyOn(globalThis, 'matchMedia').mockReturnValue({
      ...globalThis.matchMedia('unused'),
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const reduced = await chart()
    await page(reduced)
    expect(drawingProgress(reduced)).toBe(1)
    vi.restoreAllMocks()
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const request = globalThis.requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', undefined)
    const noRaf = await chart()
    await page(noRaf)
    expect(drawingProgress(noRaf)).toBe(1)
    vi.stubGlobal('requestAnimationFrame', request)
  })
})

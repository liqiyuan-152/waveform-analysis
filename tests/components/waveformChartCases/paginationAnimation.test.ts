import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames, resizeObservers } from '@tests/support/setup'
import { globalAnimator } from '@/animation/core/Animator'
import * as geometry from '@/components/animation/geometry'
import * as seriesStyle from '@/components/rendering/seriesStyle'
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
    animation: { duration: 0 },
    animationUpdate: { duration: 1000, easing: 'linear' },
    animationAnnotation: { duration: 0 },
    rendering: { sampling: { mode: 'raw' } },
    annotations,
    ...props,
  })
  wrappers.push(wrapper)
  await flushPromises()
  await nextTick()
  return wrapper
}
async function frame(ms: number) {
  now += ms
  await vi.advanceTimersByTimeAsync(ms)
  flushAnimationFrames(now)
  await nextTick()
  await flushPromises()
}
async function page(wrapper: Awaited<ReturnType<typeof chart>>, direction = 'next') {
  await wrapper.get(`.ant-pagination-${direction} button`).trigger('click')
  await flushPromises()
  await nextTick()
}
const opacity = (wrapper: Awaited<ReturnType<typeof chart>>) =>
  Number(wrapper.get('.waveform-track__series-item').attributes('opacity'))
const noteOpacity = (wrapper: Awaited<ReturnType<typeof chart>>) =>
  Number(wrapper.get('.waveform-annotation').attributes('opacity'))

beforeEach(() => {
  now = 0
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  globalAnimator.destroy()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('pagination fade', () => {
  it('fades only the new waveform and annotation without regenerating geometry', async () => {
    const wrapper = await chart()
    const projection = vi.spyOn(geometry, 'projectGeometry')
    await page(wrapper)
    expect(wrapper.get('.waveform-chart__line').attributes('data-series-id')).toBe('channel-1')
    expect(opacity(wrapper)).toBe(0)
    expect(noteOpacity(wrapper)).toBe(0)
    expect(wrapper.find('[clipPathUnits] rect').exists()).toBe(true) // outer viewport clip remains
    expect(wrapper.find('.waveform-track__series-item [clipPathUnits]').exists()).toBe(false)
    const axis = wrapper.find('.waveform-chart__track').element
    expect(axis.getAttribute('opacity')).toBeNull()
    const path = wrapper.get('.waveform-chart__line').attributes('d')
    const calls = projection.mock.calls.length
    await frame(500)
    expect(opacity(wrapper)).toBeCloseTo(0.5)
    expect(noteOpacity(wrapper)).toBeCloseTo(0.5)
    expect(wrapper.get('.waveform-chart__line').attributes('d')).toBe(path)
    expect(projection.mock.calls.length).toBe(calls)
    await frame(500)
    expect(opacity(wrapper)).toBe(1)
    expect(noteOpacity(wrapper)).toBe(1)
    expect(globalAnimator.getAnimationCount()).toBe(0)
    expect(wrapper.emitted('page-change')).toEqual([[2, 3]])
  })
  it('fades points and error bars without rerunning their path builder', async () => {
    const input = gridSeries(3)
    if (input.kind === 'series')
      input.series.forEach((series) => {
        series.pointType = 'circle'
        series.errorBar = { visible: true }
        if (series.data.kind === 'points')
          series.data.points = series.data.points.map((point) => ({ ...point, error: 0.25 }))
      })
    const wrapper = await chart({ data: input })
    const points = vi.spyOn(seriesStyle, 'waveformPointSeriesPath')
    await page(wrapper)
    expect(wrapper.find('.waveform-chart__point').exists()).toBe(true)
    expect(wrapper.find('.waveform-chart__error-bar').exists()).toBe(true)
    const count = points.mock.calls.length
    await frame(500)
    expect(opacity(wrapper)).toBeCloseTo(0.5)
    expect(points.mock.calls.length).toBe(count)
  })
  it('replaces fast page changes, fades returning pages and ignores same-page clicks', async () => {
    const complete = vi.fn(),
      abort = vi.fn()
    const wrapper = await chart({
      animationUpdate: { duration: 1000, easing: 'linear', onComplete: complete, onAbort: abort },
    })
    await page(wrapper)
    await frame(200)
    await page(wrapper)
    expect(abort).toHaveBeenCalledTimes(1)
    expect(opacity(wrapper)).toBe(0)
    expect(wrapper.get('.waveform-chart__line').attributes('data-series-id')).toBe('channel-2')
    await frame(500)
    expect(opacity(wrapper)).toBeCloseTo(0.5)
    await frame(500)
    expect(complete).toHaveBeenCalledTimes(1)
    await page(wrapper, 'prev')
    expect(opacity(wrapper)).toBe(0)
    await frame(200)
    const before = opacity(wrapper)
    await wrapper.get('.ant-pagination-item-active').trigger('click')
    expect(opacity(wrapper)).toBe(before)
    expect(wrapper.emitted('page-change')).toHaveLength(3)
  })
  it.each([
    { animationEnabled: false },
    { animationUpdate: { enabled: false } },
    { animationUpdate: { duration: 0 } },
    { animationThreshold: 0 },
    { animationThreshold: 6 },
  ])(
    'shows the new page statically when disabled or below no-animation thresholds: %j',
    async (props) => {
      const wrapper = await chart(props)
      await page(wrapper)
      expect(opacity(wrapper)).toBe(1)
      expect(noteOpacity(wrapper)).toBe(1)
      expect(globalAnimator.getAnimationCount()).toBe(0)
    },
  )
  it('uses the existing default 300ms update duration', async () => {
    const wrapper = await chart({ animationUpdate: { easing: 'linear' } })
    await page(wrapper)
    await frame(150)
    expect(opacity(wrapper)).toBeCloseTo(0.5)
    await frame(150)
    expect(opacity(wrapper)).toBe(1)
  })
  it('lets pagination pointer movement continue but commits before plot interaction', async () => {
    const wrapper = await chart()
    await page(wrapper)
    await frame(200)
    await wrapper.get('.ant-pagination-next button').trigger('pointermove')
    expect(opacity(wrapper)).toBeCloseTo(0.2)
    wrapper
      .get('svg')
      .element.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 100 }),
      )
    await nextTick()
    expect(opacity(wrapper)).toBe(1)
    expect(noteOpacity(wrapper)).toBe(1)
    expect(globalAnimator.getAnimationCount()).toBe(0)
  })
  it('commits on resize and automatic page reset without replaying', async () => {
    const wrapper = await chart()
    await page(wrapper)
    await frame(200)
    resizeObservers.at(-1)?.resize(600, 300)
    await flushPromises()
    await nextTick()
    expect(opacity(wrapper)).toBe(1)
    await wrapper.setProps({ data: gridSeries(1) })
    await flushPromises()
    expect(opacity(wrapper)).toBe(1)
    expect(wrapper.get('.waveform-chart__line').attributes('data-series-id')).toBe('channel-0')
    expect(globalAnimator.getAnimationCount()).toBe(0)
  })
  it('finishes on update disable and does not restart when enabled again', async () => {
    const wrapper = await chart()
    await page(wrapper)
    await frame(200)
    await wrapper.setProps({ animationUpdate: { enabled: false } })
    expect(opacity(wrapper)).toBe(1)
    await wrapper.setProps({ animationUpdate: { enabled: true } })
    expect(opacity(wrapper)).toBe(1)
    expect(globalAnimator.getAnimationCount()).toBe(0)
  })
  it('pauses in the background and exports full opacity while another chart continues', async () => {
    const first = await chart(),
      second = await chart()
    await page(first)
    await page(second)
    await frame(200)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await frame(500)
    expect(opacity(first)).toBeCloseTo(0.2)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await frame(300)
    expect(opacity(first)).toBeCloseTo(0.5)
    expect((await first.vm.exportImage({ format: 'svg' })).type).toBe('image/svg+xml')
    expect(opacity(first)).toBe(1)
    expect(opacity(second)).toBeCloseTo(0.5)
    first.unmount()
    second.unmount()
    expect(globalAnimator.getAnimationCount()).toBe(0)
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
    expect(opacity(reduced)).toBe(1)
    vi.restoreAllMocks()
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const request = globalThis.requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', undefined)
    const noRaf = await chart()
    await page(noRaf)
    expect(opacity(noRaf)).toBe(1)
    vi.stubGlobal('requestAnimationFrame', request)
  })
})

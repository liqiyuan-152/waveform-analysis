import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { constrainZoomDomain } from '@/components/interaction/zoomConstraints'
import {
  alignIntegerPanDomain,
  alignIntegerZoomDomain,
  integerZoomTicks,
} from '@/components/interaction/integerZoom'
import { flushAnimationFrames } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

const data = {
  kind: 'points' as const,
  points: Array.from({ length: 1001 }, (_, index) => ({ x: index / 100, y: index % 7 })),
}

describe('integer zoom', () => {
  it('aligns outwards in display units, including negative and sub-unit ranges', () => {
    expect(alignIntegerZoomDomain([-0.0012, 0.0023], { integerZoom: true })).toEqual([
      -0.002, 0.003,
    ])
    expect(alignIntegerZoomDomain([1.2, 1.3], { integerZoom: true, timeUnit: 's' })).toEqual([1, 2])
    expect(alignIntegerZoomDomain([0.001, 0.009000000000000001], { integerZoom: true })).toEqual([
      0.001, 0.009,
    ])
    expect(alignIntegerZoomDomain([1.2, 1.3], {})).toEqual([1.2, 1.3])
    expect(alignIntegerZoomDomain([1.3, -1.2], { integerZoom: true, timeUnit: 's' })).toEqual([
      -2, 2,
    ])
  })

  it('preserves minimum span and point constraints while snapping', () => {
    const groups = [{ points: [0.1, 0.7, 1.3, 2.7].map((x) => ({ x, y: x })) }]
    const domain = constrainZoomDomain([0.9, 1.1], [0, 3], [groups], {
      integerZoom: true,
      timeUnit: 's',
      minVisiblePoints: 3,
      minZoomSpan: 1.5,
    })
    expect(domain.every(Number.isInteger)).toBe(true)
    expect(domain[1] - domain[0]).toBeGreaterThanOrEqual(1.5)
    expect(
      groups[0].points.filter((p) => p.x >= domain[0] && p.x <= domain[1]).length,
    ).toBeGreaterThanOrEqual(3)
  })

  it('preserves integer viewport span while panning', () => {
    expect(alignIntegerPanDomain([1.4, 4.4], { integerZoom: true, timeUnit: 's' })).toEqual([1, 4])
    expect(alignIntegerPanDomain([0.0014, 0.0044], { integerZoom: true })).toEqual([0.001, 0.004])
    expect(alignIntegerPanDomain([1.4, 4.4], {})).toEqual([1.4, 4.4])
  })

  it('uses integer major ticks even at the smallest zoom spans', () => {
    expect(integerZoomTicks([1, 2], 8, { integerZoom: true, timeUnit: 's' })).toEqual([1, 2])
    expect(integerZoomTicks([0.001, 0.003], 8, { integerZoom: true })).toEqual([
      0.001, 0.002, 0.003,
    ])
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'snaps wheel in/out and end events in %s mode',
    async (displayMode) => {
      vi.useFakeTimers()
      const wrapper = await mountSizedChart(data, {
        displayMode,
        integerZoom: true,
        timeUnit: 's',
        initialXDomain: [10.2, -0.2],
      })
      try {
        const overlay = wrapper.get('.waveform-chart__overlay')
        const width = Number(overlay.attributes('width'))
        const wheel = async (deltaY: number) => {
          overlay.element.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY,
              clientX: width * 0.43,
              clientY: 100,
              bubbles: true,
              cancelable: true,
            }),
          )
          flushAnimationFrames()
          await flushPromises()
          await vi.advanceTimersByTimeAsync(250)
        }
        await wheel(-800)
        const zoomed = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
        expect(zoomed.every(Number.isInteger)).toBe(true)
        expect(zoomed[1] - zoomed[0]).toBeGreaterThanOrEqual(1)
        expect(zoomed[1] - zoomed[0]).toBeLessThan(12)
        const intent = wrapper.emitted('zoom-intent')?.at(-1)?.[0] as { start: number; end: number }
        const end = wrapper.emitted('zoom-end')?.at(-1)?.[0] as { start: number; end: number }
        expect([intent.start, intent.end]).toEqual(zoomed)
        expect([end.start, end.end]).toEqual(zoomed)
        await wheel(4000)
        expect(wrapper.emitted('zoom-change')?.at(-1)?.[0]).toEqual([-1, 11])
      } finally {
        wrapper.unmount()
        vi.useRealTimers()
      }
    },
  )

  it('snaps box zoom and programmatic domains in milliseconds without changing source data', async () => {
    const original = JSON.stringify(data)
    const wrapper = await mountSizedChart(data, { integerZoom: true })
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    for (const [type, fraction] of [
      ['pointerdown', 0.23456],
      ['pointerup', 0.67891],
    ] as const) {
      const event = new MouseEvent(type, {
        button: 0,
        clientX: width * fraction,
        clientY: 100,
        bubbles: true,
      })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      overlay.element.dispatchEvent(event)
    }
    await flushPromises()
    const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(domain[0]).toBeCloseTo(Math.floor(10 * 0.23456 * 1000) / 1000, 12)
    expect(domain[1]).toBeCloseTo(Math.ceil(10 * 0.67891 * 1000) / 1000, 12)
    wrapper.vm.setViewportDomain([0.1234, 0.5678])
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('123')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('568')
    await wrapper.setProps({ maxZoomScale: null })
    wrapper.vm.setViewportDomain([1.001, 1.003])
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('1001')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1003')
    expect(JSON.stringify(data)).toBe(original)
    wrapper.unmount()
  })

  it('defaults off and resets safely when enabled on a fractional viewport', async () => {
    const wrapper = await mountSizedChart(data, { timeUnit: 's' })
    expect(wrapper.props('integerZoom')).toBe(false)
    wrapper.vm.setViewportDomain([1.23, 1.56])
    await flushPromises()
    expect(Number(wrapper.get('.waveform-chart__axis-endpoint--start').text())).toBeCloseTo(1.23)
    await wrapper.setProps({ integerZoom: true })
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('10')
    await wrapper.setProps({ integerZoom: false })
    wrapper.vm.setViewportDomain([1.23, 1.56])
    await flushPromises()
    expect(Number(wrapper.get('.waveform-chart__axis-endpoint--start').text())).toBeCloseTo(1.23)
    wrapper.unmount()
  })
})

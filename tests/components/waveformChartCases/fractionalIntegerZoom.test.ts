import { describe, expect, it, vi } from 'vitest'

import {
  alignIntegerPanDomain,
  alignIntegerZoomDomain,
  integerZoomTicks,
  normalizeIntegerZoomDomain,
} from '@/components/interaction/integerZoom'
import { constrainZoomDomain } from '@/components/interaction/zoomConstraints'
import { flushAnimationFrames } from '@tests/support/setup'
import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'

const data = {
  kind: 'points' as const,
  points: Array.from({ length: 1001 }, (_, index) => ({ x: index / 100, y: index % 7 })),
}

describe('fractional integer zoom', () => {
  it.each([
    { input: [1.2, 1.8], expected: [1.2, 1.8] },
    { input: [1.8, 1.2], expected: [1.2, 1.8] },
    { input: [1, 1.4], expected: [1, 1.4] },
    { input: [1.4, 2], expected: [1.4, 2] },
    { input: [1.8, 2.2], expected: [1.8, 2.2] },
    { input: [1, 2], expected: [1, 2] },
    { input: [-1.8, -1.2], expected: [-1.8, -1.2] },
    { input: [-0.2, 0.2], expected: [-0.2, 0.2] },
    { input: [0.9999999999999999, 1.4], expected: [1, 1.4] },
  ])('aligns $input in seconds and milliseconds', ({ input, expected }) => {
    for (const timeUnit of ['s', 'ms'] as const) {
      const factor = timeUnit === 's' ? 1 : 1000
      const result = alignIntegerZoomDomain(input.map((x) => x / factor) as [number, number], {
        integerZoom: true,
        timeUnit,
      })
      result.forEach((value, index) => expect(value * factor).toBeCloseTo(expected[index], 12))
    }
  })

  it('preserves sub-unit panning across integers and recovers without realigning', () => {
    const options = { integerZoom: true, timeUnit: 's' as const }
    expect(alignIntegerPanDomain([1.9, 2.1], options)).toEqual([1.9, 2.1])
    expect(normalizeIntegerZoomDomain([1.9, 2.1], options)).toEqual([1.9, 2.1])
    expect(normalizeIntegerZoomDomain([0.9999999999999999, 2.0000000000000004], options)).toEqual([
      1, 2,
    ])
    expect(alignIntegerZoomDomain([1.9, 2.1], options)).toEqual([1.9, 2.1])
    expect(integerZoomTicks([1.9, 2.1], 4, options)).toEqual([1.9, 1.95, 2, 2.05, 2.1])
  })

  it('allows sub-unit zoom while honoring explicit limits', () => {
    const options = { integerZoom: true, timeUnit: 's' as const, maxZoomScale: null }
    const groups = [[{ points: data.points }]]
    const unconstrained = constrainZoomDomain([1.2, 1.4], [0, 10], groups, options)
    expect(unconstrained[0]).toBeCloseTo(1.2, 12)
    expect(unconstrained[1]).toBeCloseTo(1.4, 12)
    const limited = constrainZoomDomain([1.2, 1.4], [0, 10], groups, {
      ...options,
      minZoomSpan: 0.5,
      minVisiblePoints: 3,
    })
    expect(limited[1] - limited[0]).toBeGreaterThanOrEqual(0.5)
    const scaleLimited = constrainZoomDomain([1.2, 1.4], [0, 10], groups, {
      ...options,
      maxZoomScale: 10,
    })
    expect(scaleLimited[1] - scaleLimited[0]).toBeGreaterThanOrEqual(1)
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'supports decimal labels, wheel events and panning in %s mode',
    async (displayMode) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const original = JSON.stringify(data)
      const wrapper = await mountSizedChart(data, {
        displayMode,
        integerZoom: true,
        timeUnit: 's',
        pannable: true,
        maxZoomScale: null,
      })
      try {
        wrapper.vm.setViewportDomain([1.7, 1.9])
        await flushVueChartUpdates()
        const endpoints = () => [
          Number(wrapper.get('.waveform-chart__axis-endpoint--start').text()),
          Number(wrapper.get('.waveform-chart__axis-endpoint--end').text()),
        ]
        expect(endpoints()[0]).toBeCloseTo(1.7, 12)
        expect(endpoints()[1]).toBeCloseTo(1.9, 12)
        await wrapper.get('.waveform-chart').trigger('pointerenter')
        const overlay = wrapper.get('.waveform-chart__overlay')
        const width = Number(overlay.attributes('width'))
        Object.defineProperty(overlay.element, 'getBoundingClientRect', {
          value: () => ({ left: 0, top: 0, width, height: 290 }),
        })
        // Vue capture/bubble handlers must receive events newer than their attachment timestamp.
        await vi.advanceTimersByTimeAsync(1)
        const spaceDown = new KeyboardEvent('keydown', { code: 'Space', cancelable: true })
        window.dispatchEvent(spaceDown)
        expect(spaceDown.defaultPrevented).toBe(true)
        for (const [type, x] of [
          ['pointerdown', width],
          ['pointermove', 0],
          ['pointerup', 0],
        ] as const) {
          const event = new MouseEvent(type, {
            button: 0,
            clientX: x,
            clientY: 100,
            bubbles: true,
            cancelable: true,
          })
          Object.defineProperty(event, 'pointerId', { value: 72 })
          overlay.element.dispatchEvent(event)
          expect(event.defaultPrevented, type).toBe(true)
        }
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
        await flushVueChartUpdates()
        const panned = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
        expect(panned[0]).toBeCloseTo(1.9, 12)
        expect(panned[1]).toBeCloseTo(2.1, 12)
        expect(endpoints()[0]).toBeCloseTo(panned[0], 12)
        expect(endpoints()[1]).toBeCloseTo(panned[1], 12)
        await wrapper.setProps({ data: { ...data, points: [...data.points] } })
        await flushVueChartUpdates()
        expect(endpoints()[0]).toBeCloseTo(panned[0], 12)
        expect(endpoints()[1]).toBeCloseTo(panned[1], 12)

        wrapper.vm.setViewportDomain([1.2, 1.8])
        await flushVueChartUpdates()
        const wheel = async (deltaY: number) => {
          overlay.element.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY,
              clientX: width / 2,
              clientY: 100,
              bubbles: true,
              cancelable: true,
            }),
          )
          flushAnimationFrames()
          await flushVueChartUpdates()
          await vi.advanceTimersByTimeAsync(250)
        }
        await wheel(-200)
        const zoomed = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
        expect(zoomed[1] - zoomed[0]).toBeLessThan(0.6)
        expect(zoomed.some((x) => !Number.isInteger(x))).toBe(true)
        const intent = wrapper.emitted('zoom-intent')?.at(-1)?.[0] as { start: number; end: number }
        const end = wrapper.emitted('zoom-end')?.at(-1)?.[0] as { start: number; end: number }
        expect([intent.start, intent.end]).toEqual(zoomed)
        expect([end.start, end.end]).toEqual(zoomed)
        expect(endpoints()[0]).toBeCloseTo(zoomed[0], 2)
        expect(endpoints()[1]).toBeCloseTo(zoomed[1], 2)
        await wheel(800)
        await wheel(800)
        const expanded = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
        expect(expanded.every(Number.isInteger)).toBe(true)
        expect(JSON.stringify(data)).toBe(original)
      } finally {
        wrapper.unmount()
        vi.useRealTimers()
      }
    },
  )

  it('supports decimal millisecond box zoom and custom labels', async () => {
    const wrapper = await mountSizedChart(data, {
      integerZoom: true,
      initialXDomain: [0.001, 0.002],
      maxZoomScale: null,
      axes: { x: { labelFormatter: (value: number) => `t=${value.toFixed(2)}` } },
    })
    try {
      const overlay = wrapper.get('.waveform-chart__overlay')
      const width = Number(overlay.attributes('width'))
      for (const [type, fraction] of [
        ['pointerdown', 0.2],
        ['pointerup', 0.8],
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
      await flushVueChartUpdates()
      const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
      expect(domain[0]).toBeCloseTo(0.0012, 12)
      expect(domain[1]).toBeCloseTo(0.0018, 12)
      expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('t=1.20')
      expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('t=1.80')
      await wrapper.setProps({ axes: undefined })
      expect(Number(wrapper.get('.waveform-chart__axis-endpoint--start').text())).toBeCloseTo(1.2)
      expect(Number(wrapper.get('.waveform-chart__axis-endpoint--end').text())).toBeCloseTo(1.8)
    } finally {
      wrapper.unmount()
    }
  })
})

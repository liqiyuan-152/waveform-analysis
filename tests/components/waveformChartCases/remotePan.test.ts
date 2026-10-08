import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { WaveformData, WaveformPanEndPayload } from '@/index'
import { mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames } from '@tests/support/setup'

const data = (start = 10): WaveformData => ({
  kind: 'points',
  points: Array.from({ length: 11 }, (_, index) => ({ x: start + index, y: index })),
})

describe('remote horizontal panning', () => {
  it('does not request data when the drag is cancelled', async () => {
    const wrapper = await mountSizedChart(data(), { pannable: true, panXDomain: [0, 100] })
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    await wrapper.trigger('pointerenter')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    for (const [type, x] of [
      ['pointerdown', width],
      ['pointermove', 0],
      ['pointercancel', 0],
      ['pointerup', 0],
    ] as const) {
      const event = new MouseEvent(type, { button: 0, clientX: x, clientY: 100, bubbles: true })
      Object.defineProperty(event, 'pointerId', { value: 73 })
      overlay.element.dispatchEvent(event)
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    await flushPromises()
    expect(wrapper.emitted('zoom-change')).toBeDefined()
    expect(wrapper.emitted('pan-end')).toBeUndefined()
    wrapper.unmount()
  })

  for (const displayMode of ['independent', 'separated', 'compact'] as const) {
    it(`pans beyond loaded data and preserves the viewport after replacement (${displayMode})`, async () => {
      const wrapper = await mountSizedChart(data(), {
        displayMode,
        pannable: true,
        panXDomain: [0, 100],
        timeUnit: 's',
        xDomainStrategy: { type: 'data' },
      })
      wrapper.vm.setViewportDomain([18, 20])
      await flushPromises()
      const overlay = wrapper.get('.waveform-chart__overlay')
      const width = Number(overlay.attributes('width'))
      const height = Number(overlay.attributes('height'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width, height }),
      })
      const yBefore = wrapper.findAll('.waveform-chart__axis--y').map((axis) => axis.text())
      expect(yBefore.length).toBeGreaterThan(0)
      await wrapper.trigger('pointerenter')
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      for (const [type, x, y] of [
        ['pointerdown', width, height / 2],
        ['pointermove', 0, height / 4],
        ['pointerup', 0, height / 4],
      ] as const) {
        const event = new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true })
        Object.defineProperty(event, 'pointerId', { value: 71 })
        overlay.element.dispatchEvent(event)
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
      await flushPromises()
      const payload = wrapper.emitted('pan-end')?.[0]?.[0] as WaveformPanEndPayload
      expect(payload.start).toBeCloseTo(20)
      expect(payload.end).toBeCloseTo(22)
      expect(payload.trackIndex).toBe(displayMode === 'independent' ? 0 : undefined)
      if (displayMode === 'independent') expect(payload.seriesIds).toHaveLength(1)
      expect(wrapper.findAll('.waveform-chart__axis--y').map((axis) => axis.text())).toEqual(
        yBefore,
      )
      expect(wrapper.emitted('pan-end')).toHaveLength(1)
      await wrapper.setProps({ data: data(19) })
      await flushPromises()
      expect(parseFloat(wrapper.get('.waveform-chart__axis-endpoint--start').text())).toBeCloseTo(
        20,
      )
      expect(parseFloat(wrapper.get('.waveform-chart__axis-endpoint--end').text())).toBeCloseTo(22)
      // Even a sparse response must not shrink or reset the requested time window.
      await wrapper.setProps({ data: { kind: 'points', points: [{ x: 21, y: 5 }] } })
      await flushPromises()
      expect(parseFloat(wrapper.get('.waveform-chart__axis-endpoint--start').text())).toBeCloseTo(
        20,
      )
      expect(parseFloat(wrapper.get('.waveform-chart__axis-endpoint--end').text())).toBeCloseTo(22)
      await wrapper.setProps({ data: data(19) })
      await flushPromises()
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -200,
          clientX: width / 2,
          clientY: height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
      const zoomed = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
      expect(zoomed[0]).toBeGreaterThan(20)
      expect(zoomed[1]).toBeLessThan(22)
      wrapper.unmount()
    })
  }

  it.each([
    { boundary: [10, 24], start: 21, end: 23, from: 1, to: 0, expected: [22, 24] },
    { boundary: [10, 24], start: 11, end: 13, from: 0, to: 1, expected: [10, 12] },
    { boundary: [10, 24], start: 22, end: 24, from: 1, to: 0, expected: [22, 24] },
    { boundary: [24, 10], start: 18, end: 20, from: 1, to: 0, expected: [18, 20] },
    { boundary: [0, NaN], start: 18, end: 20, from: 1, to: 0, expected: [18, 20] },
  ])('clamps to record bounds and ignores invalid bounds: $boundary', async (testCase) => {
    const wrapper = await mountSizedChart(data(), {
      pannable: true,
      panXDomain: testCase.boundary,
      timeUnit: 's',
      integerZoom: true,
      xDomainStrategy: { type: 'data' },
    })
    wrapper.vm.setViewportDomain([testCase.start, testCase.end])
    await flushPromises()
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    await wrapper.trigger('pointerenter')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    for (const [type, x] of [
      ['pointerdown', width * testCase.from],
      ['pointerup', width * testCase.to],
    ] as const) {
      const event = new MouseEvent(type, { button: 0, clientX: x, clientY: 100, bubbles: true })
      Object.defineProperty(event, 'pointerId', { value: 72 })
      overlay.element.dispatchEvent(event)
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    await flushPromises()
    const [start, end] = testCase.expected
    expect(parseFloat(wrapper.get('.waveform-chart__axis-endpoint--start').text())).toBeCloseTo(
      start,
    )
    expect(parseFloat(wrapper.get('.waveform-chart__axis-endpoint--end').text())).toBeCloseTo(end)
    const changed = start !== testCase.start || end !== testCase.end
    expect(wrapper.emitted('pan-end')?.length ?? 0).toBe(changed ? 1 : 0)
    wrapper.unmount()
  })
})

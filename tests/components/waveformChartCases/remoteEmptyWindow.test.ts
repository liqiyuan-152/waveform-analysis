import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { WaveformData } from '@/types'
import { mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames, resizeObservers } from '@tests/support/setup'

const data = (count: number): WaveformData => ({
  kind: 'series',
  series: ['a', 'b'].map((id) => ({
    id,
    name: id,
    data: {
      kind: 'points',
      points: Array.from({ length: count }, (_, i) => ({ x: 12 + i / 10, y: i })),
    },
  })),
})

describe('empty remote windows', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'retains identities, viewports and interactions through empty and sparse responses (%s)',
    async (displayMode) => {
      const annotations = [{ id: 'note', seriesId: 'a', x: 12.1, y: 1, text: 'retained' }]
      const wrapper = await mountSizedChart(data(3), {
        displayMode,
        initialXDomain: [0, 10],
        panXDomain: [0, 20],
        minZoomSpan: 0.01,
        minVisiblePoints: 0,
        maxZoomScale: null,
        integerZoom: false,
        timeUnit: 's',
        xDomainStrategy: { type: 'data' },
        pannable: true,
        annotations,
        hiddenSeriesIds: ['b'],
      })
      wrapper.vm.setViewportDomain([12, 14])
      await flushPromises()
      const before = wrapper.vm.getControlState().targets[0].viewport.xDomain
      const emittedBefore = wrapper.emitted('zoom-change')?.length
      resizeObservers.at(-1)?.resize(320, 600)
      await flushPromises()
      wrapper.vm
        .getControlState()
        .targets[0].viewport.xDomain.forEach((value, index) =>
          expect(value).toBeCloseTo(before[index], 12),
        )
      for (const count of [0, 1, 3, 0]) {
        await wrapper.setProps({ data: data(count) })
        await flushPromises()
        wrapper.vm
          .getControlState()
          .targets[0].viewport.xDomain.forEach((value, index) =>
            expect(value).toBeCloseTo(before[index], 12),
          )
        expect(wrapper.emitted('zoom-change')?.length).toBe(emittedBefore)
        expect(wrapper.props('annotations')).toEqual(annotations)
        expect(wrapper.props('hiddenSeriesIds')).toEqual(['b'])
        expect(wrapper.find('.waveform-chart__overlay').exists()).toBe(true)
      }
      await wrapper.setProps({ timeUnit: 'ms' })
      await flushPromises()
      wrapper.vm
        .getControlState()
        .targets[0].viewport.xDomain.forEach((value, index) =>
          expect(value).toBeCloseTo(before[index], 12),
        )
      const overlay = wrapper.get('.waveform-chart__overlay')
      const width = Number(overlay.attributes('width'))
      const height = Number(overlay.attributes('height'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width, height }),
      })
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
      const zoomed = wrapper.vm.getControlState().targets[0].viewport.xDomain
      expect(zoomed[1] - zoomed[0]).toBeLessThan(2)
      await wrapper.trigger('pointerenter')
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      for (const [type, x] of [
        ['pointerdown', width * 0.8],
        ['pointerup', width * 0.2],
      ] as const) {
        const event = new MouseEvent(type, {
          button: 0,
          clientX: x,
          clientY: height / 2,
          bubbles: true,
        })
        Object.defineProperty(event, 'pointerId', { value: 99 })
        overlay.element.dispatchEvent(event)
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
      await flushPromises()
      expect(wrapper.emitted('pan-end')).toHaveLength(1)
      wrapper.unmount()
    },
  )

  it('keeps empty remote single-series charts usable while preserving local empty behavior', async () => {
    const empty = { kind: 'points' as const, points: [] }
    const local = await mountSizedChart(empty)
    expect(local.vm.getControlState().targets).toEqual([])
    local.unmount()
    const remote = await mountSizedChart(empty, {
      initialXDomain: [0, 10],
      panXDomain: [0, 20],
      minZoomSpan: 0.1,
    })
    expect(
      remote.vm.getControlState().targets.some((target) => target.trackId === 'series-0'),
    ).toBe(true)
    remote.vm.setViewportDomain([12, 14])
    await flushPromises()
    expect(remote.vm.getControlState().targets[0].viewport.xDomain[0]).toBeCloseTo(12)
    remote.unmount()
  })
})

import { describe, expect, it } from 'vitest'
import { constrainZoomDomain } from '@/components/interaction/zoomConstraints'
import { alignIntegerPanDomain } from '@/components/interaction/integerZoom'
import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'

describe('integer zoom precision and stable units', () => {
  it('respects fractional record boundaries and preserves fractional pan spans', () => {
    const options = { integerZoom: true, timeUnit: 's' as const, maxZoomScale: null }
    expect(constrainZoomDomain([2.8, 4.2], [2.76, 4.76], [], options)).toEqual([2.76, 4.76])
    const domain = alignIntegerPanDomain([2.8, 4.56], options)
    expect(domain[1] - domain[0]).toBeCloseTo(1.76, 12)
    expect(constrainZoomDomain([0.98, 1.02], [0, 3], [], options)).toEqual([0.98, 1.02])
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'keeps raw domains on unit changes and remote empty refill in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'points',
          points: [
            { x: 0, y: 1 },
            { x: 3, y: 2 },
          ],
        },
        {
          displayMode,
          integerZoom: true,
          timeUnit: 's',
          panXDomain: [0, 3],
          initialXDomain: [0, 3],
          maxZoomScale: null,
          minVisiblePoints: 0,
          grid: { rowCount: 1, columnCount: 1 },
        },
      )
      try {
        wrapper.vm.setViewportDomain([0.98, 1.02])
        await flushVueChartUpdates()
        const endpoints = () =>
          wrapper.findAll('.waveform-chart__axis-endpoint').map((item) => item.text())
        expect(endpoints()).toEqual(['0.98', '1.02'])
        const count = wrapper.emitted('zoom-change')?.length
        await wrapper.setProps({ timeUnit: 'ms' })
        await flushVueChartUpdates()
        expect(endpoints()).toEqual(['980', '1020'])
        await wrapper.setProps({ data: { kind: 'points', points: [] } })
        await flushVueChartUpdates()
        expect(endpoints()).toEqual(['980', '1020'])
        expect(wrapper.emitted('zoom-change')?.length).toBe(count)
        await wrapper.setProps({ timeUnit: 's' })
        await flushVueChartUpdates()
        expect(endpoints()).toEqual(['0.98', '1.02'])
      } finally {
        wrapper.unmount()
      }
    },
  )

  it.each(['independent', 'separated', 'compact'] as const)(
    'keeps a fractional local base stable when changing units in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'points',
          points: [
            { x: 0, y: 1 },
            { x: 3, y: 2 },
          ],
        },
        {
          displayMode,
          integerZoom: true,
          timeUnit: 's',
          initialXDomain: [1.23, 1.56],
          maxZoomScale: null,
          minVisiblePoints: 0,
          grid: { rowCount: 1, columnCount: 1 },
        },
      )
      try {
        wrapper.vm.setViewportDomain([1.28, 1.42])
        await flushVueChartUpdates()
        const before = wrapper.vm.getControlState().targets[0].viewport.xDomain
        await wrapper.setProps({ timeUnit: 'ms' })
        await flushVueChartUpdates()
        const after = wrapper.vm.getControlState().targets[0].viewport.xDomain
        after.forEach((value, index) => expect(value).toBeCloseTo(before[index], 12))
      } finally {
        wrapper.unmount()
      }
    },
  )
})

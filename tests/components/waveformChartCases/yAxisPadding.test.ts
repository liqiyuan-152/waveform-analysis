import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames, resizeObservers } from '@tests/support/setup'
import type { WaveformData } from '@/types'

const data: WaveformData = {
  kind: 'points',
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 100 },
  ],
}
const ticks = (wrapper: Awaited<ReturnType<typeof mountSizedChart>>) =>
  wrapper
    .findAll('.waveform-track__axis--y .tick')
    .map((t) => Number(t.attributes('data-tick-value')))

describe('Y padding chart integration', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'supports dual padding and the original maximum in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(data, {
        displayMode,
        grid: { rowCount: 1 },
        axes: { y: { nice: false, upperPaddingEnabled: true, lowerPaddingEnabled: true } },
      })
      expect(ticks(wrapper)[0]).toBe(-10)
      expect(ticks(wrapper).at(-1)).toBe(110)
      expect(wrapper.get('[data-maximum-tick]').attributes('data-tick-value')).toBe('100')
      await wrapper.setProps({
        axes: {
          y: {
            nice: false,
            upperPaddingEnabled: false,
            upperPaddingRatio: 0.1,
            lowerPaddingEnabled: true,
          },
        },
      })
      await flushPromises()
      expect(ticks(wrapper).at(-1)).toBe(100)
      expect(wrapper.find('[data-maximum-tick]').exists()).toBe(false)
      wrapper.unmount()
    },
  )
  it('hides nearby ordinary labels and strokes without moving the domain or border', async () => {
    const wrapper = await mountSizedChart(data, {
      grid: { rowCount: 1 },
      axes: { y: { nice: false, upperPaddingRatio: 0.001 } },
    })
    flushAnimationFrames()
    await flushPromises()
    const ordinary = wrapper
      .findAll('.waveform-track__axis--y .tick')
      .find((t) => t.attributes('data-tick-value') === '100.1')!
    expect(ordinary.get('text').attributes('display')).toBe('none')
    expect(ordinary.get('line').attributes('display')).toBe('none')
    expect(wrapper.get('[data-maximum-tick] text').attributes('display')).toBeUndefined()
    expect(wrapper.find('.waveform-chart__plot-frame').exists()).toBe(true)
    expect(ticks(wrapper).at(-1)).toBe(100.1)
    wrapper.unmount()
  })
  it('keeps fixed ranges unchanged and updates on replacement without accumulation', async () => {
    const wrapper = await mountSizedChart(data, {
      axes: { y: { nice: false, upperPaddingRatio: 0.1 } },
      yDomain: [0, 80],
    })
    expect(ticks(wrapper).at(-1)).toBe(80)
    expect(wrapper.find('[data-maximum-tick]').exists()).toBe(false)
    await wrapper.setProps({
      yDomain: undefined,
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 200 },
        ],
      },
    })
    await flushPromises()
    expect(ticks(wrapper).at(-1)).toBe(220)
    resizeObservers.at(-1)?.resize(360, 300)
    await flushPromises()
    await flushPromises()
    expect(ticks(wrapper).at(-1)).toBe(220)
    expect(wrapper.get('[data-maximum-tick]').attributes('data-tick-value')).toBe('200')
    wrapper.unmount()
  })
  it('preserves constant maxima and includes visible errors', async () => {
    const constant = await mountSizedChart(
      { kind: 'points', points: [{ x: 0, y: 5 }] },
      { axes: { y: { upperPaddingEnabled: true } } },
    )
    expect(constant.get('[data-maximum-tick]').attributes('data-tick-value')).toBe('5')
    constant.unmount()
    const errors = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 100, error: 20 },
        ],
      },
      { axes: { y: { nice: false, upperPaddingEnabled: true } } },
    )
    expect(
      Number(errors.get('[data-maximum-tick]').attributes('data-tick-value')),
    ).toBeGreaterThanOrEqual(100)
    errors.unmount()
  })
})

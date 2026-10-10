import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { mountSizedChart } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'

describe('multi-axis right tick formatting', () => {
  it.each([
    { domain: [0, 3000], left: 'E+03 (V) 3', right: '3 E+03 (V)' },
    { domain: [-0.0003, 0], left: 'E-04 (V) 0', right: '0 E-04 (V)' },
    { domain: [0, 3], left: '(V) 3', right: '3 (V)' },
  ])('places right-axis metadata after the value for $domain', async ({ domain, left, right }) => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: ['left', 'right'].map((id) => ({
          id,
          name: id,
          trackId: 'shared',
          unit: 'V',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: domain[0]! },
              { x: 1, y: domain[1]! },
            ],
          },
        })),
      },
      { overlayMode: 'multi-axis', yDomain: domain, axes: { y: { nice: false } } },
    )
    try {
      for (const width of [800, 375]) {
        resizeObservers.at(-1)?.resize(width, 360)
        await flushPromises()
        const leftTicks = wrapper.get('[data-y-axis-side="left"]').findAll('.tick text')
        const rightTicks = wrapper.get('[data-y-axis-side="right"]').findAll('.tick text')
        expect(leftTicks.at(-1)?.text()).toBe(left)
        expect(rightTicks.at(-1)?.text()).toBe(right)
        expect(rightTicks.slice(0, -1).map((tick) => tick.text())).toEqual(
          leftTicks.slice(0, -1).map((tick) => tick.text()),
        )
      }
      await wrapper.setProps({ unitDisplayMode: 'channel-label-or-legend' })
      await flushPromises()
      expect(wrapper.get('[data-y-axis-side="right"]').findAll('.tick text').at(-1)?.text()).toBe(
        right.replace(' (V)', ''),
      )
    } finally {
      wrapper.unmount()
    }
  })
})

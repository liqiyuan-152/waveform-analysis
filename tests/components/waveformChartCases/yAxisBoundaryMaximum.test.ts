import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'

import { updateMaximumTickVisibility } from '@/components/rendering/yAxisTickVisibility'
import { mountSizedChart } from '@tests/support/waveformChart'

describe('Y axis boundary maximum labels', () => {
  it('keeps compact track maxima and their scientific multipliers despite label collisions', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: ['first', 'second'].map((id) => ({
          id,
          name: id,
          data: { kind: 'samples' as const, values: [-2143.6, -2001], sampleRate: 1 },
        })),
      },
      {
        displayMode: 'compact',
        axes: { y: { upperPaddingEnabled: true, upperPaddingRatio: 0.1 } },
      },
    )
    try {
      const axes = wrapper.findAll('.waveform-track__axis--y')
      expect(axes).toHaveLength(2)
      for (const axis of axes) {
        for (const selector of ['[data-minimum-tick] text', '[data-maximum-tick] text']) {
          Object.defineProperty(axis.get(selector).element, 'getBoundingClientRect', {
            value: () => ({ left: 0, right: 80, top: 0, bottom: 11, width: 80, height: 11 }),
          })
        }
      }
      for (let pass = 0; pass < 2; pass++) {
        updateMaximumTickVisibility(wrapper.get('svg').element as SVGSVGElement)
        for (const axis of axes) {
          const maximum = axis.get('[data-maximum-tick]')
          expect(maximum.get('text').attributes('display')).toBeUndefined()
          expect(maximum.get('line').attributes('display')).toBeUndefined()
          expect(maximum.get('text').text()).toContain('E+03')
          expect(axis.get('[data-minimum-tick] text').attributes('display')).toBeUndefined()
          expect(
            axis.findAll('.tick text').filter((text) => text.text().includes('E+03')),
          ).toHaveLength(1)
        }
      }
    } finally {
      wrapper.unmount()
    }
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'omits ticks above the maximum in %s mode and updates after domain changes',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'points',
          points: [
            { x: 0, y: -1 },
            { x: 1, y: 1 },
          ],
        },
        { displayMode, yDomain: [-2, 2], axes: { y: { nice: false } } },
      )
      try {
        for (const domain of [
          [-2, 2],
          [-3, 3],
        ] as [number, number][]) {
          await wrapper.setProps({ yDomain: domain })
          await flushPromises()
          const ticks = wrapper.findAll('.waveform-chart__axis--y .tick')
          expect(ticks.every((tick) => Number(tick.attributes('data-tick-value')) <= 1)).toBe(true)
          expect(ticks[0].get('text').attributes('display')).toBeUndefined()
          // Original data extremes inside the frame remain available.
          expect(wrapper.get('[data-maximum-tick] text').attributes('display')).toBeUndefined()
          expect(wrapper.get('[data-minimum-tick] text').attributes('display')).toBeUndefined()
          expect(wrapper.find('.waveform-chart__series').exists()).toBe(true)
        }
      } finally {
        wrapper.unmount()
      }
    },
  )

  it('keeps the scientific multiplier on the highest visible label of left and right axes', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: ['first', 'second'].map((id) => ({
          id,
          name: id,
          trackId: 'shared',
          data: {
            kind: 'points' as const,
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 2000 },
            ],
          },
        })),
      },
      { overlayMode: 'multi-axis', yDomain: [0, 4000], axes: { y: { nice: false } } },
    )
    try {
      const axes = wrapper.findAll('.waveform-chart__axis--y')
      expect(axes).toHaveLength(2)
      axes.forEach((axis) => {
        const labels = axis
          .findAll('.tick text')
          .filter((text) => text.attributes('display') !== 'none')
        expect(labels.filter((text) => text.text().includes('E+03'))).toHaveLength(1)
        expect(labels.at(-1)!.text()).toContain('E+03')
        expect(axis.findAll('.tick text').at(-1)!.attributes('display')).toBeUndefined()
      })
    } finally {
      wrapper.unmount()
    }
  })
})

describe('enabled maximum ticks at the upper boundary', () => {
  const data = {
    kind: 'points' as const,
    points: [
      { x: 0, y: -73 },
      { x: 1, y: 86 },
    ],
  }
  it.each(['independent', 'separated', 'compact'] as const)(
    'keeps labels and strokes visible and toggles reactively in %s',
    async (displayMode) => {
      const axes = {
        y: {
          nice: true,
          upperPaddingEnabled: false,
          lowerPaddingRatio: 0.1,
          maximumTickVisible: true,
        },
      }
      const w = await mountSizedChart(data, { displayMode, animationEnabled: false, axes })
      const verify = (boundary: boolean) => {
        const tick = w.get('[data-maximum-tick]')
        expect(tick.attributes('data-tick-value')).toBe('86')
        expect(Number(tick.attributes('data-tick-y')) === 0).toBe(boundary)
        expect(tick.get('text').attributes('display')).toBeUndefined()
        expect(tick.get('line').attributes('display')).toBeUndefined()
        expect(tick.get('text').attributes('dominant-baseline')).toBe('central')
        expect(tick.get('text').attributes('dy')).toBe('0')
      }
      try {
        verify(true)
        const axis = w.get('.waveform-track__axis--y')
        const domain = [
          axis.attributes('data-label-domain-min'),
          axis.attributes('data-label-domain-max'),
        ]
        await w.setProps({ axes: { y: { ...axes.y, maximumTickVisible: false } } })
        await flushPromises()
        expect(w.find('[data-maximum-tick]').exists()).toBe(false)
        expect([
          axis.attributes('data-label-domain-min'),
          axis.attributes('data-label-domain-max'),
        ]).toEqual(domain)
        await w.setProps({ axes })
        await flushPromises()
        verify(true)
        await w.setProps({
          axes: { y: { ...axes.y, upperPaddingEnabled: true, upperPaddingRatio: 0.1 } },
        })
        await flushPromises()
        verify(false)
        await w.setProps({ axes })
        await flushPromises()
        verify(true)
        updateMaximumTickVisibility(w.get('svg').element as SVGSVGElement)
        verify(true)
      } finally {
        w.unmount()
      }
    },
  )
  it('preserves merged ordinary ticks on left and right scientific axes, including fixed bounds', async () => {
    const w = await mountSizedChart(
      {
        kind: 'series',
        series: ['a', 'b'].map((id) => ({
          id,
          name: id,
          trackId: 'shared',
          data: { kind: 'samples' as const, values: [0, 2000], sampleRate: 1 },
        })),
      },
      {
        overlayMode: 'multi-axis',
        animationEnabled: false,
        yDomain: [0, 2000],
        axes: { y: { nice: true, maximumTickVisible: true } },
      },
    )
    try {
      const axes = w.findAll('.waveform-track__axis--y')
      expect(axes.map((axis) => axis.attributes('data-y-axis-side'))).toEqual(['left', 'right'])
      for (const axis of axes) {
        const tick = axis.get('[data-maximum-tick]')
        expect(tick.attributes('data-tick-y')).toBe('0')
        expect(tick.get('text').attributes('display')).toBeUndefined()
        expect(tick.get('line').attributes('display')).toBeUndefined()
        expect(tick.get('text').text()).toContain('E+03')
        expect(
          axis.findAll('.tick').filter((t) => t.attributes('data-tick-value') === '2000'),
        ).toHaveLength(1)
      }
      await w.setProps({ axes: { y: { maximumTickVisible: false } } })
      await flushPromises()
      for (const axis of axes) {
        const tick = axis.findAll('.tick').find((t) => t.attributes('data-tick-value') === '2000')!
        expect(tick.get('text').attributes('display')).toBe('none')
        expect(tick.get('line').attributes('display')).toBe('none')
        const visible = axis.findAll('.tick text').filter((t) => t.attributes('display') !== 'none')
        expect(visible.at(-1)!.text()).toContain('E+03')
      }
    } finally {
      w.unmount()
    }
  })
  it('keeps both extrema visible when an enabled boundary maximum overlaps the minimum', async () => {
    const w = await mountSizedChart(data, {
      axes: { y: { upperPaddingEnabled: false, lowerPaddingEnabled: false } },
    })
    try {
      for (const selector of ['[data-minimum-tick] text', '[data-maximum-tick] text']) {
        Object.defineProperty(w.get(selector).element, 'getBoundingClientRect', {
          value: () => ({ left: 0, right: 30, top: 0, bottom: 11, width: 30, height: 11 }),
        })
      }
      updateMaximumTickVisibility(w.get('svg').element as SVGSVGElement)
      expect(w.get('[data-minimum-tick] text').attributes('display')).toBeUndefined()
      expect(w.get('[data-maximum-tick] text').attributes('display')).toBeUndefined()
      expect(w.get('[data-maximum-tick] line').attributes('display')).toBeUndefined()
    } finally {
      w.unmount()
    }
  })
})

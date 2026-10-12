import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { updateMaximumTickVisibility } from '@/components/rendering/yAxisTickVisibility'
import { mountSizedChart } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'

describe('Y-axis endpoint tick strokes', () => {
  it.each(['default', 'edge-compact'] as const)(
    'keeps endpoint values without strokes on both sides in %s layout',
    async (layoutPreset) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [0, 1].map((index) => ({
            id: `series-${index}`,
            name: `Series ${index}`,
            trackId: 'shared',
            data: { kind: 'samples' as const, values: [-10, 0, 10], sampleRate: 1 },
          })),
        },
        { layoutPreset, overlayMode: 'multi-axis', axes: { y: { nice: false } } },
      )
      const verify = () => {
        const axes = wrapper.findAll('.waveform-chart__axis--y')
        expect(axes.map((axis) => axis.attributes('data-y-axis-side'))).toEqual(['left', 'right'])
        for (const axis of axes) {
          const ticks = axis.findAll('.tick')
          for (const tick of [ticks[0]!, ticks.at(-1)!]) {
            expect(tick.get('line').attributes('display')).toBe('none')
            expect(tick.get('text').attributes('display')).toBeUndefined()
            expect(tick.get('text').text()).not.toBe('')
          }
          for (const tick of ticks.slice(1, -1)) {
            expect(tick.get('line').attributes('display')).toBeUndefined()
          }
        }
      }
      try {
        verify()
        updateMaximumTickVisibility(wrapper.get('svg').element as SVGSVGElement)
        verify()
        await wrapper.setProps({ yDomain: [-20, 20] })
        resizeObservers.at(-1)?.resize(360, 260)
        await flushPromises()
        verify()
      } finally {
        wrapper.unmount()
      }
    },
  )
})

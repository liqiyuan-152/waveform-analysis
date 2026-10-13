import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from '@/App.vue'
import { WaveformChart } from '@/components'
import { resizeObservers } from '@tests/support/setup'

describe('demo initial X-axis range', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'extends initial and reset bounds without rounding zoomed viewports in %s mode',
    async (displayMode) => {
      const wrapper = mount(App)
      try {
        await flushPromises()
        if (displayMode !== 'independent') {
          await wrapper.get(`input[value="${displayMode}"]`).setValue(true)
          await flushPromises()
        }
        resizeObservers.at(-1)?.resize(800, 800)
        await flushPromises()
        const chart = wrapper.getComponent(WaveformChart)
        const recordDomain = chart.props('initialXDomain')!
        expect(chart.props('integerZoom')).toBe(true)
        expect(recordDomain[1] * 1000).toBeCloseTo(5999.9, 8)
        expect(chart.props('panXDomain')).toEqual([-5, 6])
        const domains = () =>
          chart.vm.getControlState().targets.map((target) => target.viewport.xDomain)
        const assertInitialDomain = () => {
          expect(domains().length).toBeGreaterThan(0)
          domains().forEach((domain) => expect(domain).toEqual([-5, 6]))
          expect(
            chart.findAll('.waveform-chart__axis-endpoint--end').map((el) => el.text()),
          ).toContain('6000')
        }
        assertInitialDomain()

        await wrapper.get('[aria-label="整数缩放"]').trigger('click')
        await flushPromises()
        chart.vm.setViewportDomain([1.2345, 1.4567])
        await flushPromises()
        domains().forEach((domain) => {
          expect(domain[0]).toBeCloseTo(1.2345, 10)
          expect(domain[1]).toBeCloseTo(1.4567, 10)
        })
        chart.vm.resetViewport()
        await flushPromises()
        assertInitialDomain()
        expect(chart.props('initialXDomain')).toEqual(recordDomain)
      } finally {
        wrapper.unmount()
      }
    },
  )
})

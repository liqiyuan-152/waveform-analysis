import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from '@demo/App.vue'
import { WaveformChart } from 'waveform-analysis/vue'

describe('integer zoom demo control', { timeout: 20_000 }, () => {
  it('defaults on for remote windows and updates the chart through the sidebar switch', async () => {
    const wrapper = mount(App)
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)
    expect(chart.props('integerZoom')).toBe(true)
    await wrapper.get('[aria-label="整数缩放"]').trigger('click')
    expect(chart.props('integerZoom')).toBe(false)
    await wrapper.get('[aria-label="整数缩放"]').trigger('click')
    expect(chart.props('integerZoom')).toBe(true)
    wrapper.unmount()
  })
})

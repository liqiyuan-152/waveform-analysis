import { resizeChart } from '@tests/support/setup'
import { mount } from '@vue/test-utils'
import { flushVueChartUpdates } from '@tests/support/waveformChart'
import { InputNumber } from 'ant-design-vue'
import { expect, it } from 'vitest'
import App from '@demo/App.vue'
import { WaveformChart } from 'waveform-analysis/vue'

it('passes the demo point size control to the public chart', async () => {
  const wrapper = mount(App, { attachTo: document.body })
  try {
    resizeChart(800, 800)
    await flushVueChartUpdates()
    const chart = wrapper.getComponent(WaveformChart)
    const input = wrapper
      .findAllComponents(InputNumber)
      .find((control) => control.find('input').attributes('aria-label') === '点大小（px）')!
    expect(input.props('value')).toBe(2)
    expect(input.props('min')).toBe(0.5)
    expect(input.props('step')).toBe(0.5)
    expect(chart.props('pointSize')).toBe(2)
    input.vm.$emit('update:value', 4.5)
    await flushVueChartUpdates()
    expect(chart.props('pointSize')).toBe(4.5)
    const point = wrapper.get('.waveform-chart__point').attributes('d')
    expect(point).toContain('A2.25,2.25')
  } finally {
    wrapper.unmount()
  }
})

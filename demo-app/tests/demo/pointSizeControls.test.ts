import { resizeChart, flushAnimationFrames } from '@tests/support/setup'
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
    flushAnimationFrames(performance.now() + 2000)
    await flushVueChartUpdates()
    const chart = wrapper.getComponent(WaveformChart)
    const input = wrapper
      .findAllComponents(InputNumber)
      .find((control) => control.find('input').attributes('aria-label') === '点大小（px）')!
    expect(input.props('value')).toBeCloseTo(2 * Math.sqrt(48 / Math.PI))
    expect(input.props('min')).toBe(0.5)
    expect(input.props('step')).toBe(0.5)
    expect(chart.props('pointSize')).toBeCloseTo(2 * Math.sqrt(48 / Math.PI))
    const originalPoint = wrapper.get('.waveform-chart__point').attributes('d')!
    const radius = Number(originalPoint.match(/A([^,]+)/)![1])
    expect(Math.PI * radius ** 2).toBeCloseTo(48)
    const errorBar = wrapper.get('.waveform-chart__error-bar').attributes('d')
    input.vm.$emit('update:value', 4.5)
    await flushVueChartUpdates()
    expect(chart.props('pointSize')).toBe(4.5)
    const point = wrapper.get('.waveform-chart__point').attributes('d')
    expect(point).toContain('A2.25,2.25')
    expect(wrapper.get('.waveform-chart__error-bar').attributes('d')).toBe(errorBar)
    input.vm.$emit('update:value', null)
    input.vm.$emit('change', null)
    await flushVueChartUpdates()
    expect(chart.props('pointSize')).toBeCloseTo(2 * Math.sqrt(48 / Math.PI))
    expect(wrapper.get('.waveform-chart__point').attributes('d')).toBe(originalPoint)
  } finally {
    wrapper.unmount()
  }
})

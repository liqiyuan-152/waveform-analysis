import { flushPromises, mount } from '@vue/test-utils'
import { InputNumber } from 'ant-design-vue'
import { describe, expect, it } from 'vitest'

import App from '../App.vue'
import { WaveformChart } from '../components'

describe('plot margin demo controls', () => {
  it('updates the chart top and bottom margins from the sidebar', async () => {
    const wrapper = mount(App)
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)
    const controls = wrapper.get('.plot-margin-controls').findAllComponents(InputNumber)

    expect(controls).toHaveLength(2)
    expect(controls[0]?.props('value')).toBe(18)
    expect(controls[1]?.props('value')).toBe(52)
    expect(chart.props('plotMargin')).toEqual({ top: 18, bottom: 52 })

    controls[0]?.vm.$emit('update:value', 30)
    controls[1]?.vm.$emit('update:value', 70)
    await flushPromises()

    expect(chart.props('plotMargin')).toEqual({ top: 30, bottom: 70 })
    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-top')).toBe('30')
    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-bottom')).toBe('70')
    wrapper.unmount()
  })
})

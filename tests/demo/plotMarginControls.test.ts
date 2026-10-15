import { mount } from '@vue/test-utils'
import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { InputNumber } from 'ant-design-vue'
import { describe, expect, it } from 'vitest'

import App from '@/App.vue'
import { WaveformChart } from '@/components'
import { resizeObservers } from '@tests/support/setup'

describe('plot margin demo controls', { timeout: 20_000 }, () => {
  it('updates the chart top and bottom margins from the sidebar', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    resizeObservers.at(-1)?.resize(800, 800)
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)
    const controls = wrapper.get('.plot-margin-controls').findAllComponents(InputNumber)

    expect(controls).toHaveLength(2)
    expect(controls[0]?.props('value')).toBe(10)
    expect(controls[1]?.props('value')).toBe(44)
    expect(chart.props('layoutPreset')).toBe('edge-compact')
    expect(chart.props('plotMargin')).toEqual({ top: 10, bottom: 44 })

    controls[0]?.vm.$emit('update:value', 30)
    controls[1]?.vm.$emit('update:value', 70)
    await flushPromises()

    expect(chart.props('plotMargin')).toEqual({ top: 30, bottom: 70 })
    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-top')).toBe('30')
    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-bottom')).toBe('70')
    wrapper.unmount()
  })
})

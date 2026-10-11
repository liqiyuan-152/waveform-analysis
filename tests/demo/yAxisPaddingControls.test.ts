import { flushPromises, mount } from '@vue/test-utils'
import { InputNumber, Switch } from 'ant-design-vue'
import { describe, expect, it } from 'vitest'
import App from '@/App.vue'
import { WaveformChart } from '@/components'
import DemoYAxisPaddingControls from '@/demo/DemoYAxisPaddingControls.vue'

describe('Y padding demo controls', () => {
  it('keeps independent switches and ratios, and only passes configuration to the chart', async () => {
    const wrapper = mount(App)
    await flushPromises()
    const panel = wrapper.getComponent(DemoYAxisPaddingControls)
    const chart = wrapper.getComponent(WaveformChart)
    const switches = panel.findAllComponents(Switch)
    const ratios = panel.findAllComponents(InputNumber)
    expect(chart.props('axes')?.y).toMatchObject({
      upperPaddingEnabled: true,
      lowerPaddingEnabled: true,
      upperPaddingRatio: 0.1,
      lowerPaddingRatio: 0.1,
    })
    switches[0]!.vm.$emit('update:checked', false)
    ratios[1]!.vm.$emit('update:value', 20)
    await flushPromises()
    expect(chart.props('axes')?.y).toMatchObject({
      upperPaddingEnabled: false,
      lowerPaddingEnabled: true,
      upperPaddingRatio: 0.1,
      lowerPaddingRatio: 0.2,
    })
    expect(ratios[0]!.props('disabled')).toBe(true)
    expect(ratios[0]!.props('value')).toBe(10)
    switches[0]!.vm.$emit('update:checked', true)
    await flushPromises()
    expect(ratios[0]!.props('disabled')).toBe(false)
    wrapper.unmount()
  })
})

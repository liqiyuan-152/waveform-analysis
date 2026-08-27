import { flushPromises, mount } from '@vue/test-utils'
import { InputNumber, Select } from 'ant-design-vue'
import { describe, expect, it } from 'vitest'

import App from '../App.vue'
import { WaveformChart } from '../components'
import { formatDemoTimestamp } from './useDemoXAxisLabelControls'

describe('X-axis label demo controls', () => {
  it('formats timestamps in fixed UTC and China-standard-time formats', () => {
    expect(formatDemoTimestamp(0, 'UTC', false)).toBe('1970-01-01 00:00:00')
    expect(formatDemoTimestamp(123, 'UTC', true)).toBe('1970-01-01 00:00:00.123')
    expect(formatDemoTimestamp(0, 'Asia/Shanghai', false)).toBe('1970-01-01 08:00:00')
    expect(formatDemoTimestamp(Number.NaN, 'UTC', false)).toBe('NaN')
  })

  it('configures numeric and timestamp labels from the sidebar', async () => {
    const wrapper = mount(App)
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)

    expect(chart.props('axes')).toEqual({
      x: { lineVisible: false },
      y: { lineVisible: false },
    })
    expect(wrapper.find('[aria-label="自定义 X 轴 Label"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="X 轴 Label 运算倍率"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="X 轴 Label 小数位数"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="X 轴 Label 格式类型"]').exists()).toBe(false)

    await wrapper.get('[aria-label="自定义 X 轴 Label"]').trigger('click')
    await flushPromises()
    const inputNumbers = wrapper.findAllComponents(InputNumber)
    const multiplierInput = inputNumbers.find((input) =>
      input.find('[aria-label="X 轴 Label 运算倍率"]').exists(),
    )
    const fractionDigitsInput = inputNumbers.find((input) =>
      input.find('[aria-label="X 轴 Label 小数位数"]').exists(),
    )
    expect(multiplierInput).toBeDefined()
    expect(fractionDigitsInput).toBeDefined()
    expect(multiplierInput?.props('value')).toBe(1)
    expect(fractionDigitsInput?.props('value')).toBe(3)
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toMatch(/\.000$/)

    multiplierInput?.vm.$emit('update:value', 2)
    fractionDigitsInput?.vm.$emit('update:value', 2)
    await flushPromises()
    const formatter = chart.props('axes')?.x?.labelFormatter
    expect(formatter).toBeTypeOf('function')
    expect(formatter?.(1.234, {} as never)).toBe('2.47')
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toMatch(/\.00$/)

    const formatSelect = wrapper
      .findAllComponents(Select)
      .find((select) => select.find('[aria-label="X 轴 Label 格式类型"]').exists())
    expect(formatSelect?.props('value')).toBe('number')
    formatSelect?.vm.$emit('update:value', 'datetime')
    await flushPromises()
    expect(wrapper.find('[aria-label="X 轴 Label 运算倍率"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="X 轴 Label 小数位数"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="X 轴 Label 时区"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="X 轴 Label 显示毫秒"]').exists()).toBe(true)
    expect(chart.props('axes')?.x?.labelFormatter?.(0, {} as never)).toBe('1970-01-01 08:00:00')

    await wrapper.get('[aria-label="X 轴 Label 显示毫秒"]').trigger('click')
    await flushPromises()
    expect(chart.props('axes')?.x?.labelFormatter?.(123, {} as never)).toBe(
      '1970-01-01 08:00:00.123',
    )
    const timeZoneSelect = wrapper
      .findAllComponents(Select)
      .find((select) => select.find('[aria-label="X 轴 Label 时区"]').exists())
    timeZoneSelect?.vm.$emit('update:value', 'UTC')
    await flushPromises()
    expect(chart.props('axes')?.x?.labelFormatter?.(123, {} as never)).toBe(
      '1970-01-01 00:00:00.123',
    )

    await wrapper.get('[aria-label="自定义 X 轴 Label"]').trigger('click')
    await flushPromises()
    expect(chart.props('axes')?.x?.labelFormatter).toBeUndefined()
    expect(wrapper.find('[aria-label="X 轴 Label 运算倍率"]').exists()).toBe(false)
    wrapper.unmount()
  }, 10_000)
})

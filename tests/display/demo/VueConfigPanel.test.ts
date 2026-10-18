// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { Select } from 'ant-design-vue'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { Waveform, type WaveformSeries } from 'waveform-analysis/display'
import ConfigPanel from '../../../demo-app/src/display/components/config-panel/ConfigPanel.vue'
import { OptionsDraft } from '../../../demo-app/src/display/config/OptionsDraft'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn())
  document.body.replaceChildren()
})
function setup() {
  const chartHost = document.createElement('div')
  const initial = {
    line: { color: '#2563eb', width: 2 },
    yAxes: [
      { id: 'left', position: 'left' as const },
      { id: 'right', position: 'right' as const },
    ],
  }
  const series = shallowRef<WaveformSeries[]>([
    { id: 'a', name: 'CH1', yAxis: 'left', data: [{ x: 0, y: 1 }] },
    { id: 'b', name: 'CH2', yAxis: 'right', data: [{ x: 1, y: 2 }] },
  ])
  const chart = new Waveform(chartHost, series.value, initial)
  const options = shallowRef(chart.getOptions()),
    empty = shallowRef(false)
  const draft = new OptionsDraft(initial)
  const patches = vi.fn()
  const Component = defineComponent({
    setup: () => () =>
      h(ConfigPanel, {
        options: options.value,
        series: series.value,
        empty: empty.value,
        onField: (path: string, value: unknown) => {
          const patch = draft.set(path, value)
          patches(patch)
          chart.updateOptions(patch)
          options.value = chart.getOptions()
        },
        onSeries: (value: WaveformSeries[]) => {
          series.value = value
          chart.updateData(value)
        },
        onMode: (mode: 'single' | 'multiple') => {
          const change = draft.switchAxes(mode, series.value)
          chart.update(change)
          series.value = change.data
          options.value = chart.getOptions()
        },
        onEmpty: (value: boolean) => {
          empty.value = value
          chart.updateData(value ? [] : series.value)
        },
      }),
  })
  const wrapper = mount(Component, { attachTo: document.body })
  cleanup.push(() => {
    wrapper.unmount()
    chart.destroy()
  })
  const button = async (label: string) => {
    const entry = wrapper
      .findAll('[role=tab], .ant-segmented-item, button')
      .find((button) => button.text().replace(/\s/g, '') === label)
    if (!entry) throw new Error(`Missing button ${label}`)
    await entry.trigger('click')
  }
  const field = (label: string) => {
    const entry = wrapper
      .findAll('.config-field')
      .find((field) => field.find('.config-field__label').text() === label)
    if (!entry) throw new Error(`Missing field ${label}`)
    return entry
  }
  return { wrapper, chart, options, series, patches, draft, button, field }
}

describe('Vue configuration behavior', () => {
  it('rejects invalid CSS colors and zero tick steps without changing the chart', async () => {
    const { button, field, patches, chart } = setup()
    await button('线点')
    const before = chart.getOptions().line?.color
    const calls = patches.mock.calls.length
    await field('线条颜色').find('input[type="text"]').setValue('definitely-not-a-color')
    expect(field('线条颜色').find('[role="alert"]').exists()).toBe(true)
    expect(chart.getOptions().line?.color).toBe(before)
    expect(patches).toHaveBeenCalledTimes(calls)
    await button('坐标轴')
    await field('刻度步长').find('input').setValue('0')
    expect(field('刻度步长').find('[role="alert"]').exists()).toBe(true)
    expect(chart.getOptions().xAxis?.tickStep).toBeUndefined()
  })
  it('submits minimal patches and preserves sibling values, precision, optional clearing and validation', async () => {
    const { button, field, patches, chart } = setup()
    await button('线点')
    await field('线条宽度').find('input').setValue('4.5')
    expect(patches).toHaveBeenLastCalledWith({ line: { width: 4.5 } })
    expect(chart.getOptions().line).toMatchObject({ color: '#2563eb', width: 4.5 })
    await button('坐标轴')
    await field('最小值').find('input').setValue('10')
    await field('最小值').find('input').setValue('')
    expect(chart.getOptions().xAxis?.min).toBeUndefined()
    await field('刻度步长').find('input').setValue('2.5')
    expect(chart.getOptions().xAxis?.tickStep).toBe(2.5)
    const calls = patches.mock.calls.length
    await field('数字格式').find('input').setValue('invalid format')
    expect(field('数字格式').find('[role="alert"]').exists()).toBe(true)
    expect(patches).toHaveBeenCalledTimes(calls)
  })

  it('preserves alpha colors, shared grid settings and empty preview', async () => {
    const { button, field, chart } = setup()
    await button('网格')
    await button('零线')
    await field('零线颜色').find('input[type="text"]').setValue('rgba(255, 0, 0, 0.5)')
    await field('零线透明度').find('input').setValue('0.25')
    expect(chart.getOptions().zeroLine).toMatchObject({
      color: 'rgba(255, 0, 0, 0.5)',
      opacity: 0.25,
    })
    await button('网格线')
    field('辅助线样式').findComponent(Select).vm.$emit('update:value', 'solid')
    await nextTick()
    await field('辅助线宽度').find('input').setValue('1.5')
    expect(chart.getOptions().grid).toMatchObject({
      style: 'solid',
      width: 1.5,
      x: { visible: true },
      y: { visible: true },
    })
    await button('文字')
    await button('空状态')
    await field('预览空数据状态').find('[role=switch]').trigger('click')
    expect(chart.toSVGString()).toContain('No waveform data')
  })

  it('keeps raw axis defaults absent and restores axes and bindings through mode changes', async () => {
    const { wrapper, button, field, draft, series, chart } = setup()
    await button('坐标轴')
    await button('值轴')
    wrapper
      .findAllComponents(Select)
      .find((select) => select.attributes('aria-label') === '选择值轴')!
      .vm.$emit('update:value', 1)
    await nextTick()
    await field('轴线颜色').find('input[type="text"]').setValue('#123456')
    expect(draft.options.yAxes?.[1].title).toBeUndefined()
    await button('单值轴')
    expect(series.value.every((item) => item.yAxis === 'left')).toBe(true)
    await field('轴线颜色').find('input[type="text"]').setValue('#abcdef')
    await button('多值轴')
    expect(chart.getOptions().yAxes?.map((axis) => axis.color)).toEqual(['#abcdef', '#123456'])
    expect(series.value.map((item) => item.yAxis)).toEqual(['left', 'right'])
    expect(draft.options.yAxes?.[0].title).toBeUndefined()
  })

  it('supports keyboard tabs, remembered subsections and series style inheritance', async () => {
    const { wrapper, button, field, series } = setup()
    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[0].trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(tabs[1].attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[1].element)
    await button('数据点')
    await button('布局')
    await button('线点')
    expect(field('数据点大小').exists()).toBe(true)
    await button('曲线')
    const inherited = wrapper.find('.inherit-toggle input')
    await inherited.setValue(false)
    expect(series.value[0].style?.color).toBe('#2563eb')
    await inherited.setValue(true)
    expect(series.value[0].style?.color).toBeUndefined()
    await button('数据点')
    expect(field('显示数据点').exists()).toBe(true)
  })
})

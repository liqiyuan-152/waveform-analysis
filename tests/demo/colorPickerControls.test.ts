import { mount } from '@vue/test-utils'
import { ColorPicker } from 'vue3-colorpicker'
import { describe, expect, it } from 'vitest'
import { resizeChart } from '@tests/support/setup'
import { flushVueChartUpdates } from '@tests/support/waveformChart'
import App from '@/App.vue'
import { WaveformChart } from '@/components'

describe('demo color controls', { timeout: 20_000 }, () => {
  it('preserves independent grid color alpha values in chart options', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    try {
      resizeChart(800, 800)
      await flushVueChartUpdates()
      const horizontal = wrapper.get('[aria-label="水平网格线颜色"]').getComponent(ColorPicker)
      const vertical = wrapper.get('[aria-label="垂直网格线颜色"]').getComponent(ColorPicker)
      for (const picker of [horizontal, vertical]) {
        expect(picker.props('disableAlpha')).toBe(false)
        expect(picker.props('format')).toBe('rgb')
      }
      horizontal.vm.$emit('update:pureColor', 'rgba(30, 60, 90, 0.25)')
      vertical.vm.$emit('update:pureColor', 'rgba(90, 60, 30, 0)')
      await flushVueChartUpdates()
      const lines = wrapper.getComponent(WaveformChart).props('grid')?.trackLines
      expect(Object.values(lines ?? {}).length).toBeGreaterThan(0)
      for (const line of Object.values(lines ?? {})) {
        expect(line.horizontalColor).toBe('rgba(30, 60, 90, 0.25)')
        expect(line.verticalColor).toBe('rgba(90, 60, 30, 0)')
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('uses vue3-colorpicker without history for every sidebar color', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    try {
      resizeChart(800, 800)
      await flushVueChartUpdates()
      const sidebar = wrapper.get('.control-panel')
      expect(sidebar.find('.waveform-color-input').exists()).toBe(false)
      const pickers = sidebar.findAllComponents(ColorPicker)
      expect(pickers).toHaveLength(7)
      for (const picker of pickers) {
        expect(picker.props('pickerType')).toBe('chrome')
        expect(picker.props('disableHistory')).toBe(true)
        expect(picker.props('disableAlpha')).toBe(false)
        expect(picker.props('format')).toBe('rgb')
        picker.vm.$emit('update:pureColor', 'rgba(99, 71, 138, 0.4)')
      }
      await flushVueChartUpdates()
      for (const picker of pickers) expect(picker.props('pureColor')).toBe('rgba(99, 71, 138, 0.4)')
    } finally {
      wrapper.unmount()
    }
  })
})

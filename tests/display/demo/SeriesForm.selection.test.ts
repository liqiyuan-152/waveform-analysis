// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Select } from 'ant-design-vue'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import SeriesForm from '../../../demo-app/src/display/components/config-panel/SeriesForm.vue'
import type { WaveformSeries } from 'waveform-analysis/display'

describe('series selection after data changes (OpenSpec 9.26)', () => {
  it('keeps a valid selected index while the dataset shrinks, empties and grows', async () => {
    const series: WaveformSeries[] = Array.from({ length: 4 }, (_, i) => ({
      id: `s${i}`,
      name: `Channel ${i}`,
      data: [],
    }))
    const current = shallowRef(series)
    const wrapper = mount(
      defineComponent({ setup: () => () => h(SeriesForm, { series: current.value, options: {} }) }),
    )
    try {
      wrapper.findComponent(Select).vm.$emit('update:value', 3)
      await nextTick()
      expect(wrapper.findComponent(Select).props('value')).toBe(3)
      current.value = [{ id: 'small', name: 'Small sample', data: [] }]
      await nextTick()
      expect(wrapper.findComponent(Select).props('value')).toBe(0)
      expect(wrapper.find('.series-selector').text()).toContain('Small sample')
      expect(wrapper.find('.series-selector').text()).not.toContain('Channel 3')
      current.value = []
      await nextTick()
      expect(wrapper.findComponent(Select).exists()).toBe(false)
      current.value = series
      await nextTick()
      expect(wrapper.findComponent(Select).props('value')).toBe(0)
      expect(wrapper.find('.series-selector').text()).toContain('Channel 0')
    } finally {
      wrapper.unmount()
    }
  })
})

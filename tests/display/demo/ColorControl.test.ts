// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { Slider } from 'ant-design-vue'
import ColorControl from '../../../demo-app/src/display/components/config-panel/ColorControl.vue'

describe('color control', () => {
  it.each([
    ['rgba(37, 99, 235, 0)', 'rgb(37, 99, 235)'],
    ['#2563eb00', 'rgb(37, 99, 235)'],
    ['#f000', 'rgb(255, 0, 0)'],
    ['hsla(0, 100%, 50%, 0)', 'rgb(255, 0, 0)'],
  ])('retains explicit RGB channels when restoring transparent %s', async (value, expected) => {
    const wrapper = mount(ColorControl, {
      attachTo: document.body,
      props: { label: '颜色', value },
    })
    try {
      await wrapper.find('button').trigger('click')
      await nextTick()
      wrapper.findComponent(Slider).vm.$emit('change', 1)
      expect(wrapper.emitted('change')?.slice(-1)[0]).toEqual([expected])
    } finally {
      wrapper.unmount()
      document.body.replaceChildren()
    }
  })

  it('selects presets and changes alpha without losing RGB channels', async () => {
    const wrapper = mount(ColorControl, {
      attachTo: document.body,
      props: { label: '颜色', value: 'rgba(18, 52, 86, 0.5)' },
    })
    await wrapper.find('button').trigger('click')
    await nextTick()
    const preset = document.querySelector<HTMLButtonElement>('button[aria-label="颜色 #dc2626"]')!
    expect(preset).not.toBeNull()
    expect(document.querySelector('[role="slider"]')?.getAttribute('aria-label')).toBe('颜色透明度')
    preset.click()
    expect(wrapper.emitted('change')?.slice(-1)[0]).toEqual(['#dc2626'])
    wrapper.findComponent(Slider).vm.$emit('change', 0.25)
    expect(wrapper.emitted('change')?.slice(-1)[0]).toEqual(['rgba(18, 52, 86, 0.25)'])
    wrapper.unmount()
    document.body.replaceChildren()
  })
})

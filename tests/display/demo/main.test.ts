// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Select } from 'ant-design-vue'
import { nextTick } from 'vue'
import App from '../../../demo-app/src/display/App.vue'

describe('demo data selection', () => {
  it('switches the preview and series controls between datasets', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const wrapper = mount(App, { attachTo: '#app' })
    await nextTick()

    const original = Array.from(document.querySelectorAll<HTMLElement>('.ant-segmented-item')).find(
      (item) => item.textContent === '原始数据',
    )!
    const scientific = Array.from(
      document.querySelectorAll<HTMLElement>('.ant-segmented-item'),
    ).find((item) => item.textContent === '小数值测试')!
    scientific.click()
    await nextTick()
    await nextTick()

    expect(String(scientific.classList.contains('ant-segmented-item-selected'))).toBe('true')
    expect(
      document.querySelector('.waveform-axis-y--left .waveform-axis-y-header')?.textContent,
    ).toBe('ms\u00a0\u00a0E-04')
    const seriesTab = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (button) => button.textContent === '曲线',
    )!
    seriesTab.click()
    await nextTick()
    expect(
      wrapper
        .findAllComponents(Select)
        .find((select) => select.attributes('aria-label') === '选择曲线')
        ?.props('options')?.length,
    ).toBe(1)

    original.click()
    await nextTick()
    await nextTick()
    expect(String(original.classList.contains('ant-segmented-item-selected'))).toBe('true')
    expect(String(scientific.classList.contains('ant-segmented-item-selected'))).toBe('false')
    expect(
      document.querySelector('.waveform-axis-y--left .waveform-axis-y-header')?.textContent,
    ).not.toContain('E-04')
    const originalSeriesTab = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((button) => button.textContent === '曲线')!
    originalSeriesTab.click()
    await nextTick()
    expect(
      wrapper
        .findAllComponents(Select)
        .find((select) => select.attributes('aria-label') === '选择曲线')
        ?.props('options')?.length,
    ).toBe(4)
    wrapper.unmount()
  })
})

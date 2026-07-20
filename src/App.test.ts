import { flushPromises, mount } from '@vue/test-utils'
import { InputNumber, Select } from 'ant-design-vue'
import { describe, expect, it } from 'vitest'
import { ColorPicker } from 'vue3-colorpicker'

import App from './App.vue'

describe('App workspace layout', () => {
  it('places controls in the sidebar beside the chart', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const panel = wrapper.get('#waveform-control-panel')
    const frameControls = panel.get('.frame-style-controls')
    expect(panel.find('h1').exists()).toBe(false)
    expect(panel.find('[aria-label="波形展示方式"]').exists()).toBe(true)
    expect(panel.find('[aria-label="波形叠加方式"]').exists()).toBe(true)
    expect(panel.find('[aria-label="波形网格尺寸"]').exists()).toBe(true)
    expect(frameControls.findAllComponents(ColorPicker)).toHaveLength(2)
    expect(frameControls.text()).toContain('边框颜色')
    expect(frameControls.text()).toContain('背景颜色')
    expect(frameControls.find('[aria-label="图框线宽"]').exists()).toBe(true)
    expect(frameControls.find('[aria-label="图框线型"]').exists()).toBe(true)
    expect(frameControls.find('[aria-label="显示图框水印"]').exists()).toBe(true)
    expect(frameControls.get('.frame-style-control--switch .ant-switch').classes()).toContain(
      'ant-switch-small',
    )
    const titleControls = panel.get('.title-controls')
    expect(panel.find('[aria-label="显示标题"]').exists()).toBe(true)
    expect(titleControls.find('[aria-label="标题名称"]').exists()).toBe(true)
    expect(titleControls.find('[aria-label="标题对齐方式"]').exists()).toBe(true)
    expect(titleControls.find('[aria-label="标题字体"]').exists()).toBe(true)
    expect(titleControls.find('[aria-label="标题字号"]').exists()).toBe(true)
    expect(titleControls.find('[aria-label="标题旋转角度"]').exists()).toBe(true)
    expect(titleControls.findAllComponents(ColorPicker)).toHaveLength(1)
    expect(panel.find('[aria-label="图例位置"]').exists()).toBe(true)
    expect(panel.find('[aria-label="图例排列"]').exists()).toBe(true)
    const legendColorControl = panel.get('.legend-color-control')
    const legendColorPicker = legendColorControl.getComponent(ColorPicker)
    expect(legendColorControl.text()).toContain('背景')
    expect(legendColorPicker.props('pureColor')).toBe('rgba(255, 255, 255, 0.7)')
    expect(legendColorPicker.props('disableAlpha')).toBe(false)
    expect(panel.text()).not.toContain('数据摘要')
    expect(wrapper.get('.chart-panel').find('.waveform-chart').exists()).toBe(true)

    wrapper.unmount()
  })

  it('switches overlaid tracks between single-axis and multi-axis rendering', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const overlayControl = wrapper.get('[aria-label="波形叠加方式"]')
    expect(wrapper.get('.waveform-chart').attributes('data-overlay-mode')).toBe('single-axis')
    expect(overlayControl.text()).toContain('单值轴')
    expect(overlayControl.text()).toContain('多值轴')

    await overlayControl.findAll('input[type="radio"]')[1]?.setValue(true)
    await flushPromises()

    expect(wrapper.get('.waveform-chart').attributes('data-overlay-mode')).toBe('multi-axis')
    expect(wrapper.findAll('.waveform-chart__axis--y').length).toBeGreaterThan(1)

    wrapper.unmount()
  })

  it('renders three additional sample series in the first frame', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const firstFrameLines = wrapper
      .get('.waveform-chart__track[data-track-index="0"]')
      .findAll('.waveform-chart__line')

    expect(firstFrameLines.map((line) => line.attributes('data-series-name'))).toEqual([
      'BT2_2M',
      'TEST_CH_1',
      'TEST_CH_3',
      'TEST_CH_4',
      'TEST_CH_5',
    ])

    wrapper.unmount()
  })

  it('updates title content, text styles, and visibility', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const renderedTitle = () => wrapper.get('.waveform-chart__title-text')
    expect(renderedTitle().text()).toMatch(/^Shot:\d+$/)
    expect(renderedTitle().attributes('style')).toContain('Microsoft YaHei')
    expect(renderedTitle().attributes('style')).toContain('font-size: 14px')
    expect(renderedTitle().attributes('style')).toContain('font-weight: 400')

    await wrapper.get('input[aria-label="标题名称"]').setValue('实验标题')
    await wrapper.get('[aria-label="标题粗体"]').trigger('click')
    await wrapper.get('[aria-label="标题斜体"]').trigger('click')
    await wrapper.get('[aria-label="标题下划线"]').trigger('click')
    await flushPromises()

    expect(renderedTitle().text()).toBe('实验标题')
    expect(renderedTitle().attributes('style')).toContain('font-weight: 700')
    expect(renderedTitle().attributes('style')).toContain('font-style: italic')
    expect(renderedTitle().attributes('style')).toContain('text-decoration: underline')

    await wrapper.get('[aria-label="恢复标题常规样式"]').trigger('click')
    await flushPromises()
    expect(renderedTitle().attributes('style')).toContain('font-weight: 400')
    expect(renderedTitle().attributes('style')).toContain('font-style: normal')
    expect(renderedTitle().attributes('style')).toContain('text-decoration: none')

    await wrapper.get('[aria-label="显示标题"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.waveform-chart__title-area').exists()).toBe(false)

    wrapper.unmount()
  })

  it('updates every visible frame from the frame style controls', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const frameControls = wrapper.get('.frame-style-controls')
    const colorPickers = frameControls.findAllComponents(ColorPicker)
    const widthInput = frameControls.findAllComponents(InputNumber)[0]
    const styleSelect = frameControls.findAllComponents(Select)[0]

    expect(colorPickers).toHaveLength(2)
    expect(widthInput).toBeDefined()
    expect(styleSelect).toBeDefined()

    colorPickers[0].vm.$emit('update:pureColor', 'rgba(220, 38, 38, 0.8)')
    colorPickers[1].vm.$emit('update:pureColor', 'rgba(14, 165, 233, 0.25)')
    widthInput?.vm.$emit('update:value', 3)
    styleSelect?.vm.$emit('update:value', 'dashed')
    await flushPromises()

    const frames = wrapper.findAll('.waveform-chart__plot-frame')
    const backgrounds = wrapper.findAll('.waveform-chart__plot-background')
    expect(frames.length).toBeGreaterThan(1)
    expect(backgrounds).toHaveLength(frames.length)
    frames.forEach((frame) => {
      expect(frame.attributes()).toMatchObject({
        stroke: 'rgba(220, 38, 38, 0.8)',
        'stroke-width': '3',
        'stroke-dasharray': '6 4',
      })
    })
    backgrounds.forEach((background) => {
      expect(background.attributes('fill')).toBe('rgba(14, 165, 233, 0.25)')
    })

    wrapper.unmount()
  })

  it('shows and hides every frame watermark from the frame style controls', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const watermarkToggle = wrapper.get('[aria-label="显示图框水印"]')
    const initialWatermarks = wrapper.findAll('.waveform-chart__watermark')
    const initialFrameNumbers = initialWatermarks.map((watermark) => watermark.text())

    expect(initialWatermarks.length).toBeGreaterThan(1)

    await watermarkToggle.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__watermark')).toHaveLength(0)

    await watermarkToggle.trigger('click')
    await flushPromises()
    expect(
      wrapper.findAll('.waveform-chart__watermark').map((watermark) => watermark.text()),
    ).toEqual(initialFrameNumbers)

    wrapper.unmount()
  })

  it('updates every visible legend from the alpha-enabled background picker', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const colorPicker = wrapper.get('.legend-color-control').getComponent(ColorPicker)
    colorPicker.vm.$emit('update:pureColor', 'rgba(15, 118, 110, 0.35)')
    await flushPromises()

    const legendPanels = wrapper.findAll('.waveform-legend__panel')
    expect(legendPanels.length).toBeGreaterThan(0)
    legendPanels.forEach((panel) => {
      expect(panel.attributes('style')).toContain('background-color: rgba(15, 118, 110, 0.35)')
    })

    wrapper.unmount()
  })

  it('opens and closes the mobile control drawer', async () => {
    const wrapper = mount(App)
    const toggle = wrapper.get('.mobile-control-toggle')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.control-panel').classes()).not.toContain('is-open')
    expect(wrapper.find('.control-backdrop').exists()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.control-panel').classes()).toContain('is-open')
    expect(wrapper.find('.control-backdrop').exists()).toBe(true)

    await wrapper.get('.control-backdrop').trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.control-panel').classes()).not.toContain('is-open')

    await toggle.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.control-backdrop').exists()).toBe(false)

    wrapper.unmount()
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { InputNumber, Select } from 'ant-design-vue'
import { describe, expect, it, vi } from 'vitest'
import { ColorPicker } from 'vue3-colorpicker'

import App from './App.vue'
import { WaveformChart, type WaveformData } from './components'

describe('App workspace layout', { timeout: 20_000 }, () => {
  it('restores full data and invalidates a pending zoom request', async () => {
    vi.useFakeTimers()
    const wrapper = mount(App)
    try {
      await flushPromises()
      const chart = wrapper.getComponent(WaveformChart)
      const pointCount = (data: WaveformData) =>
        data.kind === 'series' && data.series[0]?.data.kind === 'points'
          ? data.series[0].data.points.length
          : 0
      const initialPointCount = pointCount(chart.props('data') as WaveformData)

      chart.vm.$emit('zoom-end', { start: 0, end: 0.001 })
      await wrapper.get('[aria-label="重置波形视图"]').trigger('click')
      await vi.advanceTimersByTimeAsync(100)
      await flushPromises()

      expect(pointCount(chart.props('data') as WaveformData)).toBe(initialPointCount)
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('places controls in the sidebar beside the chart', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const panel = wrapper.get('#waveform-control-panel')
    const frameControls = panel.get('.frame-style-controls')
    expect(panel.find('h1').exists()).toBe(false)
    expect(panel.find('[aria-label="波形展示方式"]').exists()).toBe(true)
    expect(panel.find('[aria-label="波形叠加方式"]').exists()).toBe(true)
    expect(panel.find('[aria-label="波形网格尺寸"]').exists()).toBe(true)
    const gridSizeInputs = panel.get('[aria-label="波形网格尺寸"]').findAllComponents(InputNumber)
    expect(gridSizeInputs[0]?.props('value')).toBe(4)
    expect(gridSizeInputs[1]?.props('value')).toBe(1)
    expect(panel.find('[aria-label="显示水平网格线"]').exists()).toBe(true)
    expect(panel.find('[aria-label="显示垂直网格线"]').exists()).toBe(true)
    expect(panel.find('[aria-label="显示横轴线"]').exists()).toBe(true)
    expect(panel.find('[aria-label="显示纵轴线"]').exists()).toBe(true)
    expect(panel.find('[aria-label="水平网格线颜色"]').exists()).toBe(true)
    expect(panel.find('[aria-label="垂直网格线颜色"]').exists()).toBe(true)
    expect(panel.find('[aria-label="净图模式"]').exists()).toBe(true)
    expect(panel.find('[aria-label="显示数值 Tooltip"]').exists()).toBe(true)
    expect(panel.find('[aria-label="选择波形线型"]').exists()).toBe(true)
    expect(panel.find('[aria-label="设置波形线型"]').exists()).toBe(true)
    expect(panel.find('[aria-label="显示零值参考线"]').exists()).toBe(true)
    const zeroLineControls = panel.get('.zero-line-controls')
    expect(zeroLineControls.findAllComponents(ColorPicker)).toHaveLength(1)
    expect(zeroLineControls.find('[aria-label="零值参考线线宽"]').exists()).toBe(true)
    expect(zeroLineControls.find('[aria-label="零值参考线线型"]').exists()).toBe(true)
    expect(frameControls.findAllComponents(ColorPicker)).toHaveLength(2)
    expect(frameControls.text()).toContain('边框颜色')
    expect(frameControls.text()).toContain('背景颜色')
    expect(frameControls.find('[aria-label="图框线宽"]').exists()).toBe(true)
    expect(frameControls.find('[aria-label="图框线型"]').exists()).toBe(true)
    expect(
      frameControls.get('[aria-label="图框线型"]').getComponent(Select).props('options'),
    ).toContainEqual({ label: '点虚线', value: 'dotted' })
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

  it('passes clean view, presentation mode, and zero-line controls to the chart', async () => {
    const wrapper = mount(App)
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)

    expect(chart.props('cleanView')).toBe(false)
    expect(chart.props('presentationMode')).toBe(false)
    expect(chart.props('zeroLine')).toMatchObject({ visible: false, color: '#98a2b3', width: 1 })

    await wrapper.get('[aria-label="净图模式"]').trigger('click')
    await wrapper.get('[aria-label="展示模式"]').trigger('click')
    await wrapper.get('[aria-label="显示零值参考线"]').trigger('click')
    await flushPromises()

    expect(chart.props('cleanView')).toBe(true)
    expect(chart.props('presentationMode')).toBe(true)
    expect(chart.props('zeroLine')).toMatchObject({ visible: true, color: '#98a2b3', width: 1 })
    wrapper.unmount()
  })

  it('passes horizontal and vertical grid controls to every track', async () => {
    const wrapper = mount(App)
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)

    await wrapper.get('[aria-label="显示水平网格线"]').trigger('click')
    await flushPromises()

    const grid = chart.props('grid')
    const trackLines = grid?.trackLines
    expect(trackLines).toBeTruthy()
    expect(Object.keys(trackLines ?? {}).length).toBeGreaterThan(0)
    expect(Object.values(trackLines ?? {})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          horizontal: false,
          vertical: true,
          horizontalColor: '#dfe5ef',
          verticalColor: '#dfe5ef',
        }),
      ]),
    )
    wrapper.unmount()
  })

  it('passes independent X and Y axis-line controls to the chart', async () => {
    const wrapper = mount(App)
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)

    expect(chart.props('axes')).toEqual({
      x: { lineVisible: false },
      y: { lineVisible: false },
    })

    await wrapper.get('[aria-label="显示横轴线"]').trigger('click')
    await wrapper.get('[aria-label="显示纵轴线"]').trigger('click')
    await flushPromises()

    expect(chart.props('axes')).toEqual({
      x: { lineVisible: true },
      y: { lineVisible: true },
    })
    wrapper.unmount()
  })

  it('passes tooltip and per-series line-style controls to the chart', async () => {
    const wrapper = mount(App)
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)

    expect(chart.props('showTooltip')).toBe(true)
    await wrapper.get('[aria-label="显示数值 Tooltip"]').trigger('click')
    await flushPromises()
    expect(chart.props('showTooltip')).toBe(false)

    const seriesSelect = wrapper.get('[aria-label="选择波形线型"]').getComponent(Select)
    const lineStyleSelect = wrapper.get('[aria-label="设置波形线型"]').getComponent(Select)
    const firstSeriesId = String(
      (chart.props('data') as WaveformData).kind === 'series'
        ? (chart.props('data') as Extract<WaveformData, { kind: 'series' }>).series[0]?.id
        : '',
    )
    seriesSelect.vm.$emit('update:value', firstSeriesId)
    lineStyleSelect.vm.$emit('update:value', 'dash-dot')
    await flushPromises()

    const currentData = chart.props('data') as Extract<WaveformData, { kind: 'series' }>
    expect(currentData.series.find((series) => series.id === firstSeriesId)?.lineStyle).toBe(
      'dash-dot',
    )
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

  it('keeps the primary simulated signal in the first frame', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const firstFrame = wrapper.get('.waveform-chart__track[data-track-index="0"]')
    const firstFrameSeries = firstFrame.findAll('.waveform-chart__series')

    expect(firstFrameSeries.map((series) => series.attributes('data-series-name'))).toEqual([
      '正弦基波',
    ])

    const triangleSeries = firstFrame.get('.waveform-chart__series[data-series-name="正弦基波"]')
    expect(triangleSeries.find('.waveform-chart__line').exists()).toBe(false)
    expect(triangleSeries.get('.waveform-chart__points').attributes('data-point-type')).toBe(
      'triangle',
    )
    expect(triangleSeries.get('.waveform-chart__error-bar').attributes('stroke')).toBe('#0960bd')

    wrapper.unmount()
  })

  it('keeps the simulated channels across the paginated frames', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const tracks = wrapper.findAll('.waveform-chart__track')
    expect(tracks).toHaveLength(4)
    expect(
      tracks.map((track) =>
        track.findAll('.waveform-chart__series').map((item) => item.attributes('data-series-name')),
      ),
    ).toEqual([['正弦基波'], ['谐波扰动', '谐波对比'], ['阻尼振荡'], ['阶跃响应']])
    expect(
      tracks
        .slice(1)
        .map((track) => track.get('.waveform-chart__line').attributes('data-line-type')),
    ).toEqual(['linear', 'linear', 'linear'])
    tracks.slice(1).forEach((track) => {
      expect(track.find('.waveform-chart__points').exists()).toBe(false)
    })

    const chartData = wrapper.getComponent(WaveformChart).props('data') as Extract<
      WaveformData,
      { kind: 'series' }
    >
    const simulatedSeries = chartData.series
    expect(simulatedSeries.map((item) => item.name)).toEqual([
      '正弦基波',
      '谐波扰动',
      '谐波对比',
      '阻尼振荡',
      '阶跃响应',
      '脉冲响应',
      '带噪信号',
    ])
    simulatedSeries.forEach((item) => {
      expect(item.data.kind).toBe('points')
      if (item.data.kind === 'points') {
        expect(item.data.points).toHaveLength(1000)
        expect(item.data.points[0]?.x).toBe(-5)
      }
    })

    await wrapper.get('.ant-pagination-next button').trigger('click')
    await flushPromises()
    expect(
      wrapper
        .findAll('.waveform-chart__track')
        .map((track) => track.get('.waveform-chart__series').attributes('data-series-name')),
    ).toEqual(['脉冲响应', '带噪信号'])

    wrapper.unmount()
  })

  it('updates title content, text styles, and visibility', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const renderedTitle = () => wrapper.get('.waveform-chart__title-text')
    expect(renderedTitle().text()).toBe('模拟波形分析')
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
    const initialFrames = wrapper.findAll('.waveform-chart__plot-frame')
    expect(initialFrames.length > 1 && initialFrames.every((frame) => frame.attributes('stroke-width') === '2')).toBe(true)

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

import { resizeChart } from '@tests/support/setup'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { flushAnimationFrames } from '@tests/support/setup'
import WaveformChart from '@/components/WaveformChart.vue'
import { AnnotationDraftController } from '@/annotation/AnnotationDraftController'

import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'

describe('WaveformChart', () => {
  it('uses fixed dimensions when both width and height are specified', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: 640,
        height: 420,
      },
    })
    await flushVueChartUpdates()

    expect(wrapper.attributes('style')).toContain('width: 640px')
    expect(wrapper.attributes('style')).toContain('height: 420px')
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('640')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')

    resizeChart(640, 420)
    await flushVueChartUpdates()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('640')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')
  })

  it('allows fixed width and adaptive height to work independently', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: 640,
      },
    })
    await flushVueChartUpdates()

    expect(wrapper.attributes('style')).toContain('width: 640px')
    expect(wrapper.attributes('style')).toContain('height: 100%')

    resizeChart(640, 500)
    await flushVueChartUpdates()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('640')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('500')
  })

  it('reserves a pagination band based on the chart width instead of the viewport', async () => {
    const data = {
      kind: 'series' as const,
      series: [0, 1].map((index) => ({
        id: `series-${index}`,
        name: `series ${index}`,
        data: { kind: 'samples' as const, values: [index, index + 1], sampleRate: 1 },
      })),
    }
    const narrow = mount(WaveformChart, {
      props: { data, width: 390, height: 360, grid: { rowCount: 1, columnCount: 1 } },
    })
    await flushVueChartUpdates()
    const wide = mount(WaveformChart, {
      props: { data, width: 640, height: 360, grid: { rowCount: 1, columnCount: 1 } },
    })
    await flushVueChartUpdates()

    expect(narrow.get('.waveform-chart__svg').attributes('height')).toBe('320')
    expect(wide.get('.waveform-chart__svg').attributes('height')).toBe('360')
  })

  it('allows adaptive width and fixed height to work independently', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        height: 420,
      },
    })
    await flushVueChartUpdates()

    expect(wrapper.attributes('style')).toContain('width: 100%')
    expect(wrapper.attributes('style')).toContain('height: 420px')

    resizeChart(900, 420)
    await flushVueChartUpdates()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('900')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')
  })

  it('fills both dimensions and responds to container size changes by default', async () => {
    const wrapper = mount(WaveformChart, {
      props: { data: { kind: 'samples', values: [0, 1], sampleRate: 1 } },
    })
    await flushVueChartUpdates()

    expect(wrapper.attributes('style')).toContain('width: 100%')
    expect(wrapper.attributes('style')).toContain('height: 100%')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('180')

    resizeChart(800, 520)
    await flushVueChartUpdates()
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('800')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('520')

    resizeChart(500, 300)
    await flushVueChartUpdates()
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('500')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('300')
  })

  it('configures plot top and bottom margins and reacts to updates', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [0, 1], sampleRate: 1 },
      {
        displayMode: 'compact',
        grid: { rowCount: 1, columnCount: 1 },
        plotMargin: { top: 30, bottom: 70 },
      },
    )

    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-top')).toBe('30')
    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-bottom')).toBe('70')
    expect(wrapper.get('.waveform-chart__overlay').attributes('height')).toBe('260')
    expect(wrapper.get('.waveform-chart__svg > g').attributes('transform')).toMatch(/,\s*30\)/)

    await wrapper.setProps({ plotMargin: { top: 12 } })
    await flushVueChartUpdates()

    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-top')).toBe('12')
    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-bottom')).toBe('52')
    expect(wrapper.get('.waveform-chart__overlay').attributes('height')).toBe('296')
  })

  it('falls back to default plot margins for invalid values', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [0, 1], sampleRate: 1 },
      {
        displayMode: 'compact',
        grid: { rowCount: 1, columnCount: 1 },
        plotMargin: { top: -1, bottom: Number.NaN },
      },
    )

    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-top')).toBe('18')
    expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-bottom')).toBe('52')
    expect(wrapper.get('.waveform-chart__overlay').attributes('height')).toBe('290')
  })

  it('keeps the chart title and X-axis title fixed when plot margins change', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [0, 1], sampleRate: 1 },
      {
        displayMode: 'compact',
        grid: { rowCount: 1, columnCount: 1 },
        title: { text: '固定标题' },
      },
    )
    const titleAreaStyle = wrapper.get('.waveform-chart__title-area').attributes('style')
    const xAxisTitle = wrapper.get('.waveform-chart__x-label')
    const initialX = xAxisTitle.attributes('x')
    const initialY = xAxisTitle.attributes('y')

    await wrapper.setProps({ plotMargin: { top: 60, bottom: 90 } })
    await flushVueChartUpdates()

    expect(wrapper.get('.waveform-chart__title-area').attributes('style')).toBe(titleAreaStyle)
    expect(wrapper.get('.waveform-chart__x-label').attributes('x')).toBe(initialX)
    expect(wrapper.get('.waveform-chart__x-label').attributes('y')).toBe(initialY)
    expect(wrapper.get('.waveform-chart__svg > g').attributes('transform')).toMatch(/,\s*60\)/)
  })

  it('does not render or reserve space for missing, hidden, or blank titles', async () => {
    for (const title of [undefined, { visible: false, text: '隐藏标题' }, { text: '   ' }]) {
      const wrapper = await mountSizedChart(
        { kind: 'samples', values: [0, 1], sampleRate: 1 },
        title ? { title } : {},
      )

      expect(wrapper.find('.waveform-chart__title-area').isVisible()).toBe(false)
      expect(wrapper.get('.waveform-chart').attributes('data-title-area-height')).toBe('0')
      expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('360')
    }
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'keeps the titled empty state inside the drawing area in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        { kind: 'samples', values: [1], sampleRate: -1 },
        { displayMode, title: { text: '空数据标题' } },
      )

      expect(wrapper.get('.waveform-chart__title-text').text()).toBe('空数据标题')
      expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('316')
      expect(wrapper.get('.waveform-chart__empty').attributes('y')).toBe('158')
    },
  )

  it('renders one chart title with alignment and all supported text styles', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [0, 1], sampleRate: 1 },
      {
        title: {
          text: '  shot: #4712  ',
          align: 'right',
          textStyle: {
            color: '#c026d3',
            fontSize: 18,
            fontFamily: 'Consolas',
            rotation: 0,
            fontWeight: 700,
            fontStyle: 'italic',
            textDecoration: 'underline',
            letterSpacing: '2px',
          },
        },
      },
    )

    const area = wrapper.get('.waveform-chart__title-area')
    const visual = wrapper.get('.waveform-chart__title-visual')
    const title = wrapper.get('.waveform-chart__title-text')
    expect(area.attributes('role')).toBe('heading')
    expect(area.attributes('style')).toContain('justify-content: flex-end')
    expect(title.text()).toBe('shot: #4712')
    expect(title.attributes('style')).toContain('color: rgb(192, 38, 211)')
    expect(title.attributes('style')).toContain('font-size: 18px')
    expect(title.attributes('style')).toContain('font-family: Consolas')
    expect(title.attributes('style')).toContain('font-weight: 700')
    expect(title.attributes('style')).toContain('font-style: italic')
    expect(title.attributes('style')).toContain('text-decoration: underline')
    expect(title.attributes('style')).toContain('letter-spacing: 2px')
    expect(visual.attributes('style')).toContain('width: 752px')
    expect(title.attributes('style')).toContain('width: 752px')
    expect(title.attributes('style')).toContain('rotate(0deg)')
    expect(wrapper.get('.waveform-chart').attributes('data-title-area-height')).toBe('44')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('316')
  })

  it('normalizes invalid title numbers and wraps long titles at narrow widths', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [0, 1], sampleRate: 1 },
      {
        title: {
          text: '这是一个用于验证窄屏省略行为的很长波形分析标题',
          textStyle: { fontSize: Number.NaN, rotation: Number.POSITIVE_INFINITY },
        },
      },
    )
    resizeChart(160, 360)
    await flushVueChartUpdates()

    const title = wrapper.get('.waveform-chart__title-text')
    expect(title.attributes('style')).toContain('font-size: 14px')
    expect(title.attributes('style')).toContain('Microsoft YaHei')
    expect(title.attributes('style')).toContain('font-weight: 400')
    expect(title.attributes('style')).toContain('rotate(0deg)')
    expect(title.attributes('style')).toContain('white-space: normal')
    expect(title.attributes('style')).toContain('overflow-wrap: anywhere')
    expect(title.attributes('title')).toBeUndefined()
    expect(title.attributes('data-title-wrapped')).toBe('true')
    expect(
      Number(wrapper.get('.waveform-chart').attributes('data-title-area-height')),
    ).toBeGreaterThan(44)
  })

  it.each([45, 90, -90, 180])(
    'scales a complete long title into the rotated title area at %s degrees',
    async (rotation) => {
      const wrapper = await mountSizedChart(
        { kind: 'samples', values: [0, 1], sampleRate: 1 },
        {
          title: {
            text: '这是一个用于验证旋转缩放行为的完整波形分析标题',
            textStyle: { rotation },
          },
        },
      )
      const titleHeight = Number(
        wrapper.get('.waveform-chart').attributes('data-title-area-height'),
      )
      const title = wrapper.get('.waveform-chart__title-text')

      expect(titleHeight).toBeGreaterThanOrEqual(44)
      expect(titleHeight).toBeLessThanOrEqual(160)
      expect(Number(wrapper.get('.waveform-chart__svg').attributes('height'))).toBe(
        360 - titleHeight,
      )
      expect(title.text()).toBe('这是一个用于验证旋转缩放行为的完整波形分析标题')
      expect(title.attributes('style')).toContain(`rotate(${rotation}deg)`)
      expect(title.attributes('style')).toContain('white-space: nowrap')
      expect(Number(title.attributes('data-title-scale'))).toBeLessThanOrEqual(1)
      expect(title.attributes('data-title-wrapped')).toBeUndefined()
    },
  )

  it('updates fixed and adaptive drawing heights when the title changes', async () => {
    const fixedWrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        height: 420,
        title: { text: '固定高度标题' },
      },
    })
    await flushVueChartUpdates()
    expect(fixedWrapper.get('.waveform-chart__svg').attributes('height')).toBe('376')

    await fixedWrapper.setProps({ title: { visible: false, text: '固定高度标题' } })
    await flushVueChartUpdates()
    expect(fixedWrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')

    const adaptiveWrapper = await mountSizedChart(
      { kind: 'samples', values: [0, 1], sampleRate: 1 },
      { title: { text: '自适应高度标题' } },
    )
    expect(adaptiveWrapper.get('.waveform-chart__svg').attributes('height')).toBe('316')
    resizeChart(800, 500)
    await flushVueChartUpdates()
    expect(adaptiveWrapper.get('.waveform-chart__svg').attributes('height')).toBe('456')
  })

  it('includes the title offset in root-relative tooltip positioning', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { title: { text: 'shot: #4712' }, grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 246 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth / 2, clientY: 100, bubbles: true }),
    )
    flushAnimationFrames()
    await flushVueChartUpdates()

    const tooltipTop = Number.parseFloat(
      (wrapper.get('.waveform-chart__tooltip').element as HTMLElement).style.top,
    )
    expect(tooltipTop).toBeGreaterThanOrEqual(44)
  })

  it('includes the title offset in annotation editor anchors', async () => {
    const create = vi.spyOn(AnnotationDraftController.prototype, 'create')
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      {
        title: { text: 'shot: #4712' },
        grid: { rowCount: 1, columnCount: 1 },
        interactionMode: 'annotation',
      },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 246 }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('click', {
        clientX: overlayWidth / 2,
        clientY: 100,
        bubbles: true,
      }),
    )
    await flushVueChartUpdates()

    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0][2].y).toBe(162)
  })
})

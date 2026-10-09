import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import 'ant-design-vue/dist/antd.css'

import WaveformChart from '@/components/WaveformChart.vue'
import { gridSeries } from '@tests/support/waveformChart'

describe('edge-compact frame and pagination bounds', () => {
  it('restores the safe band when more pages or a longer Time label fills a medium width', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: gridSeries(2),
        width: 640,
        height: 360,
        layoutPreset: 'edge-compact',
        plotMargin: { top: 0, bottom: 44 },
        grid: { rowCount: 1, columnCount: 1 },
        xLabel: 'Time(ms)',
      },
    })
    await flushPromises()
    const compactHeight = Number(wrapper.get('.waveform-chart__svg').attributes('height'))
    expect(compactHeight).toBe(344)
    await wrapper.setProps({ data: gridSeries(7) })
    expect(Number(wrapper.get('.waveform-chart__svg').attributes('height'))).toBe(
      compactHeight - 24,
    )
    const pagination = wrapper.get('.waveform-chart__pagination')
    const paginationTop =
      360 -
      Number.parseFloat(getComputedStyle(pagination.element).bottom) -
      Number.parseFloat(getComputedStyle(wrapper.get('.ant-pagination-item').element).height)
    expect(Number(wrapper.get('.waveform-chart__x-label').attributes('y')) + 4).toBeLessThan(
      paginationTop,
    )
    await wrapper.setProps({
      data: gridSeries(2),
      xLabel: '很长的时间坐标轴标签（毫秒，完整显示）',
    })
    expect(Number(wrapper.get('.waveform-chart__svg').attributes('height'))).toBe(320)
    await wrapper.setProps({ cleanView: true })
    expect(wrapper.find('.waveform-chart__pagination').exists()).toBe(false)
    expect(Number(wrapper.get('.waveform-chart__svg').attributes('height'))).toBe(360)
  })

  it.each([true, false])(
    'contains all four stroke edges at top=0 with title=%s',
    async (withTitle) => {
      const wrapper = mount(WaveformChart, {
        props: {
          data: gridSeries(1),
          width: 800,
          height: 360,
          layoutPreset: 'edge-compact',
          plotMargin: { top: 0, bottom: 44 },
          grid: { rowCount: 1 },
          title: withTitle ? { text: 'shot: #1001', textStyle: { fontSize: 18 } } : undefined,
        },
      })
      for (const borderWidth of [0, 1, 2.5, 8, -1, Number.NaN]) {
        await wrapper.setProps({ frameStyle: { borderWidth } })
        const frame = wrapper.get('.waveform-chart__plot-frame')
        const track = wrapper.get('.waveform-chart__track')
        const strokeWidth = Number(frame.attributes('stroke-width'))
        const expectedWidth = Number.isFinite(borderWidth) && borderWidth >= 0 ? borderWidth : 1
        expect(strokeWidth).toBe(expectedWidth)
        const x = Number(frame.attributes('x'))
        const y = Number(frame.attributes('y'))
        // The entire painted rectangle, including half a stroke on each side, fits the plot bounds.
        expect(x - strokeWidth / 2).toBeCloseTo(0)
        expect(y - strokeWidth / 2).toBeCloseTo(0)
        expect(x + Number(frame.attributes('width')) + strokeWidth / 2).toBeCloseTo(
          Number(track.attributes('data-track-width')),
        )
        const paintedBottom = y + Number(frame.attributes('height')) + strokeWidth / 2
        expect(paintedBottom).toBeCloseTo(Number(track.attributes('data-track-height')))
        expect(
          Number(wrapper.get('.waveform-chart__svg').attributes('height')) - paintedBottom,
        ).toBeCloseTo(44)
        expect(wrapper.attributes('data-plot-margin-top')).toBe('0')
        expect(getComputedStyle(wrapper.element).overflow).toBe('hidden')
        if (withTitle) {
          const titleArea = Number(wrapper.attributes('data-title-area-height'))
          const visualHeight = Number.parseFloat(
            (wrapper.get('.waveform-chart__title-visual').element as HTMLElement).style.height,
          )
          expect((titleArea - visualHeight) / 2 + y - strokeWidth / 2).toBeCloseTo(4)
        }
      }
      await wrapper.setProps({ layoutPreset: 'default', frameStyle: { borderWidth: 2.5 } })
      const frame = wrapper.get('.waveform-chart__plot-frame')
      expect(frame.attributes('x')).toBeUndefined()
      expect(frame.attributes('y')).toBeUndefined()
      expect(frame.attributes('height')).toBe(
        wrapper.get('.waveform-chart__track').attributes('data-track-height'),
      )
    },
  )

  it.each(['solid', 'dashed', 'dotted'] as const)(
    'preserves the shared %s stroke style on all edges',
    async (borderStyle) => {
      const wrapper = mount(WaveformChart, {
        props: {
          data: gridSeries(1),
          width: 800,
          height: 360,
          layoutPreset: 'edge-compact',
          plotMargin: { top: 0, bottom: 44 },
          grid: { rowCount: 1 },
          frameStyle: { borderWidth: 4, borderStyle, borderColor: '#123456' },
        },
      })
      await flushPromises()
      const frame = wrapper.get('.waveform-chart__plot-frame')
      expect(frame.attributes('stroke')).toBe('#123456')
      expect(frame.attributes('stroke-width')).toBe('4')
      expect(frame.attributes('x')).toBe('2')
      expect(frame.attributes('y')).toBe('2')
      expect(frame.attributes('stroke-dasharray')).toBe(
        borderStyle === 'solid' ? undefined : borderStyle === 'dashed' ? '6 4' : '1 3',
      )
    },
  )

  it.each([320, 800])(
    'keeps endpoint labels safely above pagination with minimal reserved space at width %s',
    async (width) => {
      const wrapper = mount(WaveformChart, {
        props: {
          data: gridSeries(2),
          width,
          height: 360,
          layoutPreset: 'edge-compact',
          plotMargin: { top: 0, bottom: 44 },
          grid: { rowCount: 1 },
          title: { text: 'shot: #1001', textStyle: { fontSize: 18 } },
          xLabel: 'Time(ms)',
        },
      })
      await flushPromises()
      const titleArea = Number(wrapper.attributes('data-title-area-height'))
      const svgHeight = Number(wrapper.get('.waveform-chart__svg').attributes('height'))
      const paginationStyle = getComputedStyle(wrapper.get('.waveform-chart__pagination').element)
      const itemHeight = Number.parseFloat(
        getComputedStyle(wrapper.get('.ant-pagination-item').element).height,
      )
      expect(itemHeight).toBe(32)
      const paginationTop = 360 - Number.parseFloat(paginationStyle.bottom) - itemHeight
      const paginationBand = width <= 520 ? 40 : 16
      expect(titleArea + svgHeight).toBeCloseTo(360 - paginationBand)
      const track = wrapper.get('.waveform-chart__track')
      const plotBottom =
        Number(track.attributes('data-track-top')) + Number(track.attributes('data-track-height'))
      expect(svgHeight - plotBottom).toBeCloseTo(44)
      const timeBaseline = Number(wrapper.get('.waveform-chart__x-label').attributes('y'))
      expect(timeBaseline - plotBottom).toBeCloseTo(35)
      const time = wrapper.get('.waveform-chart__x-label')
      expect(getComputedStyle(time.element).fontSize).toBe('18px')
      expect(getComputedStyle(time.element).fontWeight).toBe('600')
      if (width <= 520) {
        expect(titleArea + timeBaseline + 4).toBeLessThan(paginationTop)
      } else {
        expect(360 - titleArea - plotBottom).toBeCloseTo(60)
        expect(titleArea + plotBottom - (360 - 40 - 44)).toBeCloseTo(24)
        expect(360 - titleArea - timeBaseline).toBeCloseTo(25)
      }
      const endpoint = wrapper.get('.waveform-chart__axis-endpoint--end')
      const endpointBaseline = plotBottom + Number(endpoint.attributes('y')) + 10 * 0.71
      // Allow a conservative 3px descent for the unchanged 10px endpoint text.
      const endpointBottom = titleArea + endpointBaseline + 3
      expect(paginationTop - endpointBottom).toBeCloseTo(width <= 520 ? 28.9 : 4.9)
      expect(endpointBottom).toBeLessThan(paginationTop)
    },
  )
})

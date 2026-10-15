import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import WaveformChart from '@/components/WaveformChart.vue'
import { flushVueChartUpdates, gridSeries } from '@tests/support/waveformChart'

describe('edge-compact frame and pagination bounds', () => {
  it('keeps the same height for 3 and 64 pages and long Time labels', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: gridSeries(3),
        width: 640,
        height: 360,
        layoutPreset: 'edge-compact',
        plotMargin: { top: 0, bottom: 44 },
        grid: { rowCount: 1, columnCount: 1 },
        xLabel: 'Time(ms)',
      },
    })
    await flushVueChartUpdates()
    await flushVueChartUpdates()
    const compactHeight = Number(wrapper.get('.waveform-chart__svg').attributes('height'))
    expect(compactHeight).toBe(344)
    const timeBaseline = wrapper.get('.waveform-chart__x-label').attributes('y')
    await wrapper.setProps({ data: gridSeries(64) })
    await flushVueChartUpdates()
    expect(Number(wrapper.get('.waveform-chart__svg').attributes('height'))).toBe(compactHeight)
    expect(wrapper.get('.waveform-chart__x-label').attributes('y')).toBe(timeBaseline)
    await wrapper.setProps({
      data: gridSeries(2),
      xLabel: '很长的时间坐标轴标签（毫秒，完整显示）',
    })
    await flushVueChartUpdates()
    expect(Number(wrapper.get('.waveform-chart__svg').attributes('height'))).toBe(compactHeight)
    await wrapper.setProps({ cleanView: true })
    await flushVueChartUpdates()
    expect(
      wrapper.findAll('.waveform-chart__pagination').some((element) => element.isVisible()),
    ).toBe(false)
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
      await flushVueChartUpdates()
      for (const borderWidth of [0, 1, 2.5, 8, -1, Number.NaN]) {
        await wrapper.setProps({ frameStyle: { borderWidth } })
        await flushVueChartUpdates()
        const frame = wrapper.get('.waveform-chart__plot-frame')
        const track = wrapper.get('.waveform-chart__track')
        const strokeWidth = Number(frame.attributes('stroke-width'))
        const expectedWidth = Number.isFinite(borderWidth) && borderWidth >= 0 ? borderWidth : 1
        expect(strokeWidth).toBe(expectedWidth)
        const edges = frame.attributes('d')?.match(/^M([^,]+),([^H]+)H([^V]+)V([^H]+)H/)
        expect(edges).not.toBeNull()
        const [, left, top, right, bottom] = edges!
        const x = Number(left),
          y = Number(top)
        // The entire painted rectangle, including half a stroke on each side, fits the plot bounds.
        expect(x - strokeWidth / 2).toBeCloseTo(0)
        expect(y - strokeWidth / 2).toBeCloseTo(0)
        expect(Number(right) + strokeWidth / 2).toBeCloseTo(
          Number(track.attributes('data-track-width')),
        )
        const paintedBottom = Number(bottom) + strokeWidth / 2
        expect(paintedBottom).toBeCloseTo(Number(track.attributes('data-track-height')))
        expect(
          Number(wrapper.get('.waveform-chart__svg').attributes('height')) - paintedBottom,
        ).toBeCloseTo(44)
        expect(wrapper.get('.waveform-chart').attributes('data-plot-margin-top')).toBe('0')
        expect(getComputedStyle(wrapper.get('.waveform-chart').element).overflow).toBe('hidden')
        if (withTitle) {
          const titleArea = Number(
            wrapper.get('.waveform-chart').attributes('data-title-area-height'),
          )
          const visualHeight = Number.parseFloat(
            (wrapper.get('.waveform-chart__title-visual').element as HTMLElement).style.height,
          )
          expect((titleArea - visualHeight) / 2 + y - strokeWidth / 2).toBeCloseTo(4)
        }
      }
      await wrapper.setProps({ layoutPreset: 'default', frameStyle: { borderWidth: 2.5 } })
      await flushVueChartUpdates()
      const frame = wrapper.get('.waveform-chart__plot-frame')
      expect(frame.attributes('x')).toBeUndefined()
      expect(frame.attributes('y')).toBeUndefined()
      const track = wrapper.get('.waveform-chart__track')
      expect(frame.attributes('d')).toBe(
        `M0,0H${track.attributes('data-track-width')}V${track.attributes('data-track-height')}H0Z`,
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
      await flushVueChartUpdates()
      await flushVueChartUpdates()
      const frame = wrapper.get('.waveform-chart__plot-frame')
      expect(frame.attributes('stroke')).toBe('#123456')
      expect(frame.attributes('stroke-width')).toBe('4')
      expect(frame.attributes('d')).toMatch(/^M2,2H/)
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
      await flushVueChartUpdates()
      await flushVueChartUpdates()
      const titleArea = Number(wrapper.get('.waveform-chart').attributes('data-title-area-height'))
      const svgHeight = Number(wrapper.get('.waveform-chart__svg').attributes('height'))
      const paginationStyle = getComputedStyle(wrapper.get('.waveform-chart__pagination').element)
      const itemHeight = Number.parseFloat(
        getComputedStyle(wrapper.get('[aria-current="page"]').element).height,
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
      expect(360 - titleArea - plotBottom).toBeCloseTo(paginationBand + 44)
      expect(360 - titleArea - timeBaseline).toBeCloseTo(paginationBand + 9)
      const endpoint = wrapper.get('.waveform-chart__axis-endpoint--end')
      const endpointBaseline = plotBottom + Number(endpoint.attributes('y')) + 10 * 0.71
      // Allow a conservative 3px descent for the unchanged 10px endpoint text.
      const endpointBottom = titleArea + endpointBaseline + 3
      expect(paginationTop - endpointBottom).toBeCloseTo(4.9 + paginationBand - 16)
      expect(endpointBottom).toBeLessThan(paginationTop)
      if (width <= 520) expect(titleArea + timeBaseline + 6).toBeLessThan(paginationTop)
    },
  )
})

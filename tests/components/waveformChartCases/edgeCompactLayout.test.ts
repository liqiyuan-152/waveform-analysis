import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import WaveformChart from '@/components/WaveformChart.vue'
import type { WaveformLayoutPreset } from '@/index'
import { gridSeries } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'

const preset: WaveformLayoutPreset = 'edge-compact'
const title = { text: 'shot: #1001', textStyle: { fontSize: 18, fontWeight: 700 } }

describe('WaveformChart edge-compact layout', () => {
  it('uses title visual height plus 8px and normalizes an 18px bold title', async () => {
    const wrapper = mount(WaveformChart, {
      props: { data: gridSeries(1), width: 800, height: 360, title, layoutPreset: preset },
    })
    const area = Number(wrapper.attributes('data-title-area-height'))
    const visual = wrapper.get('.waveform-chart__title-visual').element as HTMLElement
    expect(area).toBeCloseTo(18 * 1.2 + 8)
    expect((area - Number.parseFloat(visual.style.height)) / 2).toBeCloseTo(4)
    expect(wrapper.get('.waveform-chart__title-text').attributes('style')).toContain(
      'font-size: 18px',
    )
    expect(wrapper.get('.waveform-chart__title-text').attributes('style')).toContain(
      'font-weight: 600',
    )
    const label = wrapper.get('.waveform-chart__x-label')
    expect(getComputedStyle(label.element).fontSize).toBe('18px')
    expect(getComputedStyle(label.element).fontWeight).toBe('600')

    await wrapper.setProps({
      title: { text: 'Large', textStyle: { fontSize: 24, fontWeight: 700 } },
    })
    expect(wrapper.get('.waveform-chart__title-text').attributes('style')).toContain(
      'font-weight: 700',
    )

    await wrapper.setProps({
      title: { text: 'Regular', textStyle: { fontSize: 18, fontWeight: 400 } },
    })
    expect(wrapper.get('.waveform-chart__title-text').attributes('style')).toContain(
      'font-weight: 400',
    )
    expect(label.attributes('dominant-baseline')).toBeUndefined()
    expect(Number(label.attributes('y'))).toBeCloseTo(360 - area - 9)

    await wrapper.setProps({
      title: { text: 'Small', textStyle: { fontSize: 12, fontWeight: 400 } },
    })
    expect(Number(wrapper.attributes('data-title-area-height'))).toBeCloseTo(12 * 1.2 + 8)
    expect(getComputedStyle(label.element).fontSize).toBe('18px')
    expect(getComputedStyle(label.element).fontWeight).toBe('600')
  })

  it('uses measured multiline text height without multiplying the line count again', async () => {
    const wrapper = mount(WaveformChart, {
      props: { data: gridSeries(1), width: 320, height: 360, title, layoutPreset: preset },
    })
    const measure = wrapper.get('.waveform-chart__title-measure').element
    Object.defineProperties(measure, {
      scrollWidth: { value: 280 },
      scrollHeight: { value: 43.2 },
    })
    resizeObservers.at(-1)?.resize(320, 360)
    await flushPromises()
    expect(Number(wrapper.attributes('data-title-area-height'))).toBeCloseTo(51.2)
    expect(wrapper.get('.waveform-chart__title-text').attributes('style')).toContain(
      'min-height: 43.2px',
    )
  })

  it.each([0, 45, 90, -90, 180])(
    'preserves complete titles with wrapping/rotation at %s degrees',
    async (rotation) => {
      const text = '这是一个用于验证窄图框和旋转的完整波形分析标题'.repeat(3)
      const wrapper = mount(WaveformChart, {
        props: {
          data: gridSeries(1),
          width: 320,
          height: 600,
          layoutPreset: preset,
          title: { text, textStyle: { fontSize: 18, rotation } },
        },
      })
      await flushPromises()
      const heading = wrapper.get('.waveform-chart__title-text')
      const visual = wrapper.get('.waveform-chart__title-visual').element as HTMLElement
      const area = Number(wrapper.attributes('data-title-area-height'))
      expect(heading.text()).toBe(text)
      expect(heading.attributes('style')).toContain(`rotate(${rotation}deg)`)
      expect(area).toBeCloseTo(Number.parseFloat(visual.style.height) + 8)
      if (rotation === 0) {
        expect(heading.attributes('data-title-wrapped')).toBe('true')
      } else {
        expect(area).toBeLessThanOrEqual(160)
        expect(Number(heading.attributes('data-title-scale'))).toBeLessThan(1)
      }
    },
  )

  it.each([320, 520, 521, 800])(
    'reserves pagination only when buttons are visible at width %s',
    async (width) => {
      const wrapper = mount(WaveformChart, {
        props: {
          data: gridSeries(2),
          width,
          height: 360,
          layoutPreset: preset,
          title,
          grid: { rowCount: 1, columnCount: 1 },
        },
      })
      await flushPromises()
      const titleHeight = () => Number(wrapper.attributes('data-title-area-height'))
      const drawingHeight = () => Number(wrapper.get('.waveform-chart__svg').attributes('height'))
      const labelY = () => Number(wrapper.get('.waveform-chart__x-label').attributes('y'))
      const paginationBand = width <= 520 ? 40 : 16
      expect(wrapper.find('.waveform-chart__pagination').exists()).toBe(true)
      expect(drawingHeight()).toBeCloseTo(360 - titleHeight() - paginationBand)
      expect(titleHeight() + labelY()).toBeCloseTo(360 - paginationBand - 9)
      await wrapper.get('.ant-pagination-next button').trigger('click')
      expect(titleHeight() + labelY()).toBeCloseTo(360 - paginationBand - 9)

      await wrapper.setProps({ grid: { rowCount: 1, columnCount: 1, showPagination: false } })
      expect(wrapper.find('.waveform-chart__pagination').exists()).toBe(false)
      expect(drawingHeight()).toBeCloseTo(360 - titleHeight())
      expect(titleHeight() + labelY()).toBeCloseTo(351)
      await wrapper.setProps({ grid: { rowCount: 1 }, cleanView: true })
      expect(wrapper.find('.waveform-chart__pagination').exists()).toBe(false)
      expect(wrapper.find('.waveform-chart__x-label').exists()).toBe(false)
      expect(drawingHeight()).toBeCloseTo(360 - titleHeight())
      await wrapper.setProps({ cleanView: false, data: gridSeries(1) })
      expect(wrapper.find('.waveform-chart__pagination').exists()).toBe(false)
      expect(drawingHeight()).toBeCloseTo(360 - titleHeight())
    },
  )

  it.each(['independent', 'separated', 'compact'] as const)(
    'keeps time label centered and clear of ticks in %s mode',
    async (displayMode) => {
      const wrapper = mount(WaveformChart, {
        props: {
          data: gridSeries(1),
          width: 320,
          height: 360,
          layoutPreset: preset,
          displayMode,
          plotMargin: { top: 0, bottom: 35 },
          title,
          grid: { rowCount: 1 },
          xLabel: 'Time(ms)',
        },
      })
      await flushPromises()
      expect(wrapper.attributes('data-plot-margin-bottom')).toBe('44')
      const label = wrapper.get('.waveform-chart__x-label')
      expect(label.text()).toBe('Time(ms)')
      expect(wrapper.attributes('data-plot-margin-top')).toBe('0')
      const visual = wrapper.get('.waveform-chart__title-visual').element as HTMLElement
      const titleArea = Number(wrapper.attributes('data-title-area-height'))
      expect((titleArea - Number.parseFloat(visual.style.height)) / 2).toBeCloseTo(4)
      const track = wrapper.get('.waveform-chart__track')
      expect(track.attributes('data-track-top')).toBe('0')
      expect(Number(label.attributes('x'))).toBeCloseTo(
        Number(wrapper.attributes('data-chart-left-margin')) +
          Number(track.attributes('data-track-width')) / 2,
      )
      const plotBottom =
        Number(wrapper.attributes('data-plot-margin-top')) +
        Number(track.attributes('data-track-top')) +
        Number(track.attributes('data-track-height'))
      // Bound tick descent and time-label ascent conservatively; the compact baseline adds 3px of clearance.
      const drawingHeight = Number(wrapper.get('.waveform-chart__svg').attributes('height'))
      expect(drawingHeight - plotBottom).toBeCloseTo(44)
      expect(Number(label.attributes('y')) - plotBottom).toBeCloseTo(35)
      // Allow 4px of text descent; the label stays inside the SVG after moving down.
      expect(Number(label.attributes('y')) + 4).toBeLessThan(drawingHeight)
      const endpoint = wrapper.get('.waveform-chart__axis-endpoint--start')
      const endpointBaseline = plotBottom + Number(endpoint.attributes('y')) + 10 * 0.71
      expect(Number(label.attributes('y')) - endpointBaseline).toBeCloseTo(20.9)
      expect(wrapper.get('.waveform-chart__axis--x').attributes('font-size')).toBe('10')
      const labelY = Number(label.attributes('y'))
      await wrapper.setProps({ plotMargin: { top: 0, bottom: 44 } })
      expect(wrapper.attributes('data-plot-margin-bottom')).toBe('44')
      expect(Number(label.attributes('y'))).toBe(labelY)
      await wrapper.setProps({ plotMargin: { bottom: 70 } })
      expect(wrapper.attributes('data-plot-margin-bottom')).toBe('70')
      expect(Number(label.attributes('y'))).toBeCloseTo(360 - titleArea - 9)
    },
  )

  it('restores default title, time label and wide pagination behavior when switching presets', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: gridSeries(2),
        width: 800,
        height: 360,
        title,
        grid: { rowCount: 1 },
        layoutPreset: preset,
      },
    })
    await wrapper.setProps({ layoutPreset: 'default', plotMargin: { bottom: 35 } })
    expect(wrapper.attributes('data-title-area-height')).toBe('44')
    expect(wrapper.attributes('data-plot-margin-bottom')).toBe('35')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('316')
    const label = wrapper.get('.waveform-chart__x-label')
    expect(label.attributes('y')).toBe('304')
    expect(label.attributes('dominant-baseline')).toBeUndefined()
    expect(getComputedStyle(label.element).fontSize).toBe('12px')
  })
})

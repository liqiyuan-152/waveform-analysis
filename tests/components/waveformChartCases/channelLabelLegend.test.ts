import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { WaveformData, WaveformSeries } from '@/index'
import { mountSizedChart } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'

const series = (id: string, trackId = id, unit?: string): WaveformSeries => ({
  id,
  trackId,
  name: 'SX2_7_01',
  unit,
  data: {
    kind: 'points',
    points: [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ],
  },
})
const data = (...items: WaveformSeries[]): WaveformData => ({ kind: 'series', series: items })
const options = {
  unitDisplayMode: 'channel-label-or-legend' as const,
  layoutPreset: 'edge-compact' as const,
  legend: { interactive: true, trackPositions: { merged: 'bottom-left' as const } },
  grid: { rowCount: 2, columnCount: 1 },
}

describe('page channel labels and legend units', () => {
  it.each([800, 360])(
    'shows a single-channel legend with hidden page titles at %ipx',
    async (width) => {
      const wrapper = await mountSizedChart(
        data(series('one', 'one', 'V'), series('a', 'merged', 'V'), series('b', 'merged', 'A')),
        options,
      )
      resizeObservers.at(-1)?.resize(width, 360)
      await flushPromises()
      expect(wrapper.find('.waveform-chart__y-axis-label').exists()).toBe(false)
      expect(wrapper.get('[data-legend-track-id="one"] .waveform-legend__label').text()).toBe(
        'SX2_7_01 (V)',
      )
      expect(wrapper.findAll('.waveform-chart__legend')).toHaveLength(2)
      wrapper.unmount()
    },
  )

  it.each([' V ', undefined, '', '  ', '--', ' -- '])(
    'formats unit %s without mutating metadata',
    async (unit) => {
      const input = data(series('one', 'one', unit))
      const original = structuredClone(input)
      const wrapper = await mountSizedChart(input, options)
      const validUnit = unit?.trim() === 'V'
      expect(wrapper.get('.waveform-chart__y-axis-label').text()).toBe(
        validUnit ? 'SX2_7_01(V)' : 'SX2_7_01',
      )
      expect(wrapper.find('.waveform-chart__legend').exists()).toBe(false)
      await wrapper.setProps({
        data: data(series('a', 'merged', unit), series('b', 'merged', unit)),
      })
      expect(wrapper.findAll('.waveform-legend__label')[0].text()).toBe(
        validUnit ? 'SX2_7_01 (V)' : 'SX2_7_01',
      )
      expect(input).toEqual(original)
      wrapper.unmount()
    },
  )

  it.each(['single-axis', 'multi-axis'] as const)(
    'keeps page titles hidden while toggling in %s',
    async (overlayMode) => {
      const wrapper = await mountSizedChart(
        data(
          series('one', 'one', 'V'),
          series('shot1', 'merged', 'V'),
          series('shot2', 'merged', 'A'),
        ),
        {
          ...options,
          overlayMode,
          annotations: [{ id: 'note', seriesId: 'shot2', x: 0, y: 1, text: 'note' }],
        },
      )
      expect(wrapper.find('.waveform-chart__y-axis-label').exists()).toBe(false)
      expect(wrapper.find('.waveform-track__multi-axis-title').exists()).toBe(false)
      expect(wrapper.findAll('.waveform-legend__label').map((item) => item.text())).toEqual([
        'SX2_7_01 (V)',
        'SX2_7_01 (V)',
        'SX2_7_01 (A)',
      ])
      const mergedLegend = wrapper.get('[data-legend-track-id="merged"]')
      const singleLegend = wrapper.get('[data-legend-track-id="one"]')
      expect(singleLegend.findAll('.waveform-chart__legend-item')).toHaveLength(1)
      expect(mergedLegend.get('.waveform-chart__legend').attributes('data-position')).toBe(
        'bottom-left',
      )
      await mergedLegend.findAll('.waveform-chart__legend-item')[1].trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-annotation-id="note"]').exists()).toBe(false)
      expect(
        wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
      ).toEqual(['one', 'shot1'])
      expect(wrapper.find('.waveform-chart__y-axis-label').exists()).toBe(false)
      expect(wrapper.find('.waveform-track__multi-axis-title').exists()).toBe(false)
      await mergedLegend.findAll('.waveform-chart__legend-item')[0].trigger('click')
      expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(1)
      expect(wrapper.findAll('.waveform-chart__legend-item')).toHaveLength(3)
      expect(
        mergedLegend
          .findAll('.waveform-chart__legend-item')
          .every((item) => item.classes().includes('is-hidden')),
      ).toBe(true)
      await singleLegend.get('.waveform-chart__legend-item').trigger('click')
      expect(singleLegend.get('.waveform-chart__legend-item').classes()).toContain('is-hidden')
      expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(0)
      expect(wrapper.findAll('.waveform-chart__axis--y').length).toBeGreaterThan(0)
      await singleLegend.get('.waveform-chart__legend-item').trigger('click')
      await mergedLegend.findAll('.waveform-chart__legend-item')[1].trigger('click')
      expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(2)
      expect(wrapper.find('[data-annotation-id="note"]').exists()).toBe(true)
      await wrapper.setProps({ cleanView: true })
      expect(wrapper.find('.waveform-chart__legend').exists()).toBe(false)
      wrapper.unmount()
    },
  )

  it('uses only the current page and ignores empty ordered frames', async () => {
    const wrapper = await mountSizedChart(
      data(
        series('one', 'one', 'V'),
        series('two', 'two', 'A'),
        series('a', 'merged', 'V'),
        series('b', 'merged', 'A'),
      ),
      {
        ...options,
        grid: { rowCount: 2, trackOrder: ['one', 'empty', 'merged', 'two'] },
      },
    )
    expect(wrapper.get('.waveform-chart__y-axis-label').text()).toBe('SX2_7_01(V)')
    expect(wrapper.findAll('.waveform-chart__legend-item')).toHaveLength(0)
    await wrapper.get('.ant-pagination-next button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.waveform-chart__y-axis-label').exists()).toBe(false)
    expect(wrapper.findAll('.waveform-chart__legend-item')).toHaveLength(3)
    await wrapper.get('.ant-pagination-prev button').trigger('click')
    expect(wrapper.get('.waveform-chart__y-axis-label').text()).toBe('SX2_7_01(V)')
    wrapper.unmount()
  })
})

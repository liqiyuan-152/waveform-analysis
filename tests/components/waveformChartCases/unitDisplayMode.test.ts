import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { WaveformData, WaveformSeries, WaveformUnitDisplayMode } from '@/index'
import { flushAnimationFrames } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

const mode: WaveformUnitDisplayMode = 'legend-single-series'
const series = (id: string, trackId = id, unit?: string): WaveformSeries => ({
  id,
  trackId,
  name: `${id}(1001)`,
  unit,
  data: {
    kind: 'points',
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 30000 },
    ],
  },
})
const data = (...items: WaveformSeries[]): WaveformData => ({ kind: 'series', series: items })
const options = {
  unitDisplayMode: mode,
  grid: { rowCount: 1, columnCount: 1 },
  yDomain: [0, 30000],
}

describe('WaveformChart unit placement', () => {
  it.each([800, 320])(
    'hides units for multiple curves sharing one Y axis at width %s',
    async (width) => {
      const wrapper = await mountSizedChart(
        data(series('CH1', 'merged', 'V'), series('CH2', 'merged', 'V'), series('CH3', 'one', 'V')),
        { ...options, width, height: 240, overlayMode: 'single-axis', grid: { rowCount: 2 } },
      )
      expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(2)
      expect(wrapper.findAll('.waveform-legend__label').map((label) => label.text())).toEqual([
        'CH1(1001)',
        'CH2(1001)',
      ])
      wrapper.findAll('.waveform-chart__axis--y').forEach((axis) => {
        expect(axis.text()).toContain('E+04 3')
        expect(axis.text()).not.toContain('(V)')
      })
    },
  )

  it('preserves default axis units and restores them when switching back', async () => {
    const wrapper = await mountSizedChart(data(series('CH1', 'one', 'V')), {
      yDomain: [0, 30000],
    })
    expect(wrapper.find('.waveform-chart__legend').exists()).toBe(false)
    expect(wrapper.get('.waveform-chart__axis--y').text()).toContain('E+04 (V) 3')
    await wrapper.setProps({ unitDisplayMode: mode })
    await flushPromises()
    expect(wrapper.find('.waveform-chart__legend').exists()).toBe(false)
    expect(wrapper.get('.waveform-chart__y-axis-label').text()).toBe('CH1(1001)')
    expect(wrapper.get('.waveform-chart__axis--y').text()).toContain('E+04 3')
    expect(wrapper.get('.waveform-chart__axis--y').text()).not.toContain('(V)')
    await wrapper.setProps({ unitDisplayMode: 'axis' })
    await flushPromises()
    expect(wrapper.find('.waveform-chart__legend').exists()).toBe(false)
    expect(wrapper.get('.waveform-chart__axis--y').text()).toContain('E+04 (V) 3')
  })

  it.each([undefined, '', '  ', '--', ' -- '])('omits unknown legend unit %s', async (unit) => {
    const wrapper = await mountSizedChart(
      data(series('CH1', 'merged', unit), series('CH2', 'merged', unit)),
      options,
    )
    expect(wrapper.findAll('.waveform-legend__label').map((label) => label.text())).toEqual([
      'CH1(1001)',
      'CH2(1001)',
    ])
  })

  it.each(['single-axis', 'multi-axis'] as const)(
    'counts curves per track rather than Y-axis groups in %s mode and preserves tooltip metadata',
    async (overlayMode) => {
      const input = data(series('CH1', 'merged', 'V'), series('CH2', 'merged', 'A'))
      const original = structuredClone(input)
      const wrapper = await mountSizedChart(input, { ...options, overlayMode })
      expect(wrapper.findAll('.waveform-legend__label').map((label) => label.text())).toEqual([
        'CH1(1001)',
        'CH2(1001)',
      ])
      expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(
        overlayMode === 'single-axis' ? 1 : 2,
      )
      wrapper.findAll('.waveform-chart__axis--y').forEach((axis) => {
        expect(axis.text()).toMatch(/E\+04 3|3 E\+04/)
        expect(axis.text()).not.toMatch(/\([VA]\)/)
      })
      const overlay = wrapper.get('.waveform-chart__overlay--independent')
      const width = Number(overlay.attributes('width'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width, height: 200 }),
      })
      overlay.element.dispatchEvent(
        new MouseEvent('pointermove', { clientX: width / 2, clientY: 100, bubbles: true }),
      )
      flushAnimationFrames()
      await flushPromises()
      expect(wrapper.get('.waveform-chart__tooltip').text()).toContain('CH1(1001)(V)')
      expect(wrapper.get('.waveform-chart__tooltip').text()).toContain('CH2(1001)(A)')
      expect(input).toEqual(original)
    },
  )

  it('applies the multi-series rule to mixed tracks across pages even when curves are hidden', async () => {
    const wrapper = await mountSizedChart(
      data(series('CH1', 'one', 'V'), series('CH2', 'merged', 'V'), series('CH3', 'merged', 'V')),
      { ...options, hiddenSeriesIds: ['CH3'] },
    )
    expect(wrapper.find('.waveform-chart__legend').exists()).toBe(false)
    expect(wrapper.get('.waveform-chart__y-axis-label').text()).toBe('CH1(1001)')
    expect(wrapper.get('.waveform-chart__axis--y').text()).not.toContain('(V)')
    await wrapper.get('.ant-pagination-next button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-legend__label').map((label) => label.text())).toEqual([
      'CH2(1001)',
      'CH3(1001)',
    ])
    await wrapper.setProps({ hiddenSeriesIds: ['CH2', 'CH3'] })
    expect(
      wrapper.findAll('.waveform-legend__label').every((label) => !label.text().includes('(V)')),
    ).toBe(true)
    await wrapper.get('.ant-pagination-prev button').trigger('click')
    expect(wrapper.find('.waveform-chart__legend').exists()).toBe(false)
    expect(wrapper.get('.waveform-chart__y-axis-label').text()).toBe('CH1(1001)')
    await wrapper.setProps({ data: data(series('CH1', 'one', 'V')) })
    expect(wrapper.find('.waveform-chart__legend').exists()).toBe(false)
    expect(wrapper.get('.waveform-chart__y-axis-label').text()).toBe('CH1(1001)')
  })

  it.each([false, true])(
    'ignores empty ordered frames with hideEmptyTracks=%s',
    async (hideEmptyTracks) => {
      const wrapper = await mountSizedChart(
        data(series('CH1', 'one', ' V '), series('CH2', 'two', 'A')),
        {
          ...options,
          grid: {
            rowCount: 3,
            columnCount: 1,
            trackOrder: ['one', 'empty', 'two'],
            hideEmptyTracks,
          },
        },
      )
      expect(wrapper.findAll('.waveform-legend__label')).toHaveLength(0)
      expect(wrapper.findAll('.waveform-chart__y-axis-label').map((label) => label.text())).toEqual(
        ['CH1(1001)', 'CH2(1001)'],
      )
      expect(wrapper.findAll('.waveform-chart__track--empty')).toHaveLength(hideEmptyTracks ? 0 : 1)
      wrapper.findAll('.waveform-chart__track--empty').forEach((track) => {
        expect(track.find('.waveform-chart__legend').exists()).toBe(false)
      })
    },
  )
})

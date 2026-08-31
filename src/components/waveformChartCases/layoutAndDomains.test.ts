import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { resizeObservers } from '../../test/setup'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('applies the configured Y-axis split number', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 3 },
          { x: 1, y: 97 },
        ],
      },
      { axes: { y: { splitNumber: 5 } } },
    )

    expect(
      wrapper
        .get('.waveform-chart__axis--y')
        .findAll('.tick text')
        .map((tick) => tick.text()),
    ).toEqual(['0', '25', '50', '75', '100'])
  })

  it('expands the Y-axis label gutter for signed values and long exponents', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 4 }, (_, index) => ({
          id: `wide-axis-${index}`,
          name: `宽范围 ${index + 1}`,
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1e120 },
              { x: 0.5, y: 0 },
              { x: 1, y: 1e120 },
            ],
          },
        })),
      },
      { displayMode: 'compact', grid: { rowCount: 2, columnCount: 2 } },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const labelX = Number(tracks[0].attributes('data-y-axis-label-x'))
    const firstWidth = Number(tracks[0].attributes('data-track-width'))
    const secondLeft = Number(tracks[1].attributes('data-track-left'))
    const labelBackgroundX = Number(
      tracks[0].get('.waveform-chart__y-axis-label-bg').attributes('x'),
    )

    expect(labelX).toBe(-62)
    expect(labelBackgroundX).toBe(labelX - 6)
    expect(Number(wrapper.attributes('data-chart-left-margin'))).toBe(80)
    expect(secondLeft - firstWidth).toBeGreaterThanOrEqual(72)
  })

  it('keeps a tick-only gutter when channel labels are empty', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 2 }, (_, index) => ({
          id: `unnamed-${index}`,
          name: '',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1e120 },
              { x: 1, y: 1e120 },
            ],
          },
        })),
      },
      { yLabel: '', grid: { rowCount: 1, columnCount: 2 } },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstWidth = Number(tracks[0].attributes('data-track-width'))
    const secondLeft = Number(tracks[1].attributes('data-track-left'))

    expect(wrapper.findAll('.waveform-chart__y-axis-label')).toHaveLength(0)
    expect(Number(wrapper.attributes('data-chart-left-margin'))).toBe(80)
    expect(secondLeft - firstWidth).toBeGreaterThanOrEqual(60)
  })

  it('updates the Y-axis label position while preserving the chart gutter between pages', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'short-axis',
            name: '短范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            id: 'wide-axis',
            name: '宽范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1e120 },
                { x: 1, y: 1e120 },
              ],
            },
          },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const initialMargin = wrapper.attributes('data-chart-left-margin')
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe('-34')

    await wrapper.get('.ant-pagination-next button').trigger('click')

    expect(wrapper.attributes('data-chart-left-margin')).toBe(initialMargin)
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe('-62')
  })

  it('hides only secondary-column Y-axis labels when the grid is too narrow', async () => {
    const wrapper = await mountSizedChart(gridSeries(4), {
      displayMode: 'independent',
      grid: { rowCount: 2, columnCount: 2 },
    })

    resizeObservers.at(-1)?.resize(120, 360)
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__y-axis-label')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(4)
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstWidth = Number(tracks[0].attributes('data-track-width'))
    const secondLeft = Number(tracks[1].attributes('data-track-left'))
    expect(secondLeft - firstWidth).toBeGreaterThanOrEqual(32)
  })

  it('uses one shared overlay and bottom-row x axes for separated and compact grids', async () => {
    for (const displayMode of ['separated', 'compact'] as const) {
      const wrapper = await mountSizedChart(gridSeries(4), {
        displayMode,
        grid: { rowCount: 2, columnCount: 2 },
      })
      expect(wrapper.findAll('.waveform-chart__overlay--shared')).toHaveLength(1)
      expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(2)
      const tracks = wrapper.findAll('.waveform-chart__track')
      const firstTop = Number(tracks[0].attributes('data-track-top'))
      const secondRowTop = Number(tracks[2].attributes('data-track-top'))
      const firstHeight = Number(tracks[0].attributes('data-track-height'))
      if (displayMode === 'compact') expect(secondRowTop).toBe(firstTop + firstHeight)
      else expect(secondRowTop).toBeGreaterThan(firstTop + firstHeight)
    }
  })

  it('keeps unused compact cells visually empty while preserving bottom X axes', async () => {
    const data = gridSeries(4)
    if (data.kind === 'series') {
      data.series.forEach((series, index) => {
        series.data = {
          kind: 'points',
          points: [
            { x: 100, y: index },
            { x: 200, y: index + 1 },
          ],
        }
      })
    }
    const wrapper = await mountSizedChart(data, {
      displayMode: 'compact',
      grid: { rowCount: 2, columnCount: 3 },
    })

    const tracks = wrapper.findAll('.waveform-chart__track')
    const emptyTracks = wrapper.findAll('.waveform-chart__track--empty')
    const firstTrackTop = Number(tracks[0].attributes('data-track-top'))
    const firstTrackHeight = Number(tracks[0].attributes('data-track-height'))
    const secondRowFirstTrackTop = Number(tracks[3].attributes('data-track-top'))

    expect(tracks).toHaveLength(6)
    expect(emptyTracks).toHaveLength(2)
    expect(wrapper.find('.waveform-chart__grid-slot-placeholder').exists()).toBe(false)
    expect(secondRowFirstTrackTop).toBe(firstTrackTop + firstTrackHeight)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(3)
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(4)
    expect(emptyTracks[0].findAll('.waveform-chart__grid')).toHaveLength(0)
    expect(emptyTracks[0].find('.waveform-chart__plot-background').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__plot-frame').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__axis--y').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__line').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__y-axis-label').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__watermark').exists()).toBe(false)

    const populatedBottomTrack = tracks[3]
    expect(emptyTracks[0].get('.waveform-chart__axis-endpoint--start').text()).toBe(
      populatedBottomTrack.get('.waveform-chart__axis-endpoint--start').text(),
    )
    expect(emptyTracks[0].get('.waveform-chart__axis-endpoint--end').text()).toBe(
      populatedBottomTrack.get('.waveform-chart__axis-endpoint--end').text(),
    )
  })

  it('shows the global empty state when compact data has no valid channels', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [1], sampleRate: -1 },
      { displayMode: 'compact', grid: { rowCount: 2, columnCount: 3 } },
    )

    expect(wrapper.get('.waveform-chart__empty').text()).toContain('暂无有效波形数据')
    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(0)
  })

  it('resets the page when the grid configuration changes', async () => {
    const wrapper = await mountSizedChart(gridSeries(5), {
      grid: { rowCount: 1, columnCount: 1 },
    })
    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.get('.ant-pagination-item-2').classes()).toContain('ant-pagination-item-active')

    await wrapper.setProps({ grid: { rowCount: 2, columnCount: 1 } })
    await flushPromises()
    expect(wrapper.get('.ant-pagination-item-1').classes()).toContain('ant-pagination-item-active')
  })

  it('keeps the shared x domain stable while paging separated and compact grids', async () => {
    for (const displayMode of ['separated', 'compact'] as const) {
      const wrapper = await mountSizedChart(gridSeries(3), {
        displayMode,
        grid: { rowCount: 1, columnCount: 1 },
      })
      const initialEnd = wrapper.get('.waveform-chart__axis-endpoint--end').text()
      await wrapper.get('.ant-pagination-next button').trigger('click')
      expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe(initialEnd)
    }
  })

  it('uses the shared initial x domain for every independent track by default', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'narrow-track',
            name: '窄范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 0.006, y: 1 },
              ],
            },
          },
          {
            id: 'wide-track',
            name: '宽范围',
            data: {
              kind: 'points',
              points: [
                { x: -8, y: 0 },
                { x: 5, y: 1 },
              ],
            },
          },
        ],
      },
      {
        displayMode: 'independent',
        grid: { rowCount: 1, columnCount: 2 },
        initialXDomain: [-8, 5],
      },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    expect(tracks[0]?.get('.waveform-chart__axis-endpoint--start').text()).toBe('-8000')
    expect(tracks[0]?.get('.waveform-chart__axis-endpoint--end').text()).toBe('5000')
    expect(tracks[1]?.get('.waveform-chart__axis-endpoint--start').text()).toBe('-8000')
    expect(tracks[1]?.get('.waveform-chart__axis-endpoint--end').text()).toBe('5000')
  })

  it('uses an explicit initial x domain override for an independent track', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'narrow-track',
            name: '窄范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 0.006, y: 1 },
              ],
            },
          },
        ],
      },
      {
        displayMode: 'independent',
        initialXDomain: [-8, 5],
        initialXDomains: { 'narrow-track': [0, 1] },
      },
    )

    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1000')
  })

  it('reacts to nice fixed Y-domain props and returns to automatic bounds', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 100 },
      ],
    })
    const yTickLabels = () =>
      wrapper
        .get('.waveform-chart__axis--y')
        .findAll('.tick text')
        .map((tick) => tick.text())

    await wrapper.setProps({ yDomain: [3, 97] })
    await flushPromises()
    expect(yTickLabels()).toContain('0')
    expect(yTickLabels()).toContain('100')

    await wrapper.setProps({ yDomain: undefined })
    await flushPromises()
    expect(yTickLabels()).not.toContain('3')
    expect(yTickLabels()).not.toContain('97')
  })

  it('keeps annotations bound to their channel while paging', async () => {
    const wrapper = await mountSizedChart(gridSeries(3), {
      grid: { rowCount: 1, columnCount: 1 },
      annotations: [
        { id: 'channel-2-note', seriesId: 'channel-1', x: 1, y: 2, text: '当前页标注' },
      ],
    })
    expect(wrapper.find('[data-annotation-id="channel-2-note"]').exists()).toBe(false)
    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.find('[data-annotation-id="channel-2-note"]').exists()).toBe(true)
  })

  it('renders a path for sample data and responds to width changes', async () => {
    const wrapper = await mountSizedChart({
      kind: 'samples',
      values: [0, 1, -1, 0.5],
      sampleRate: 4,
    })
    const initialPath = wrapper.get('.waveform-chart__line').attributes('d')

    expect(initialPath).toContain('L')
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('800')
    expect(wrapper.attributes('data-interaction-mode')).toBeUndefined()

    resizeObservers.at(-1)?.resize(500, 360)
    await flushPromises()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('500')
    expect(wrapper.get('.waveform-chart__line').attributes('d')).not.toBe(initialPath)
  })
})

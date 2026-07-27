import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { type WaveformData } from '../waveform'
import WaveformChartView from '../WaveformChartView.vue'

import { gridSeries, mountSizedChart, visibilitySeries } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('resolves legend positions by stable track id across pages', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 8 }, (_, index) => ({
          id: `series-${index}`,
          trackId: `frame-${Math.floor(index / 2)}`,
          name: `series ${index}`,
          data: {
            kind: 'points' as const,
            points: [
              { x: 0, y: index },
              { x: 1, y: index + 1 },
            ],
          },
        })),
      },
      {
        grid: { rowCount: 2, columnCount: 1, showPagination: true },
        legend: {
          position: 'left',
          orientation: 'auto',
          trackPositions: {
            'frame-0': 'top',
            'frame-1': 'bottom-right',
            'frame-2': 'bottom',
          },
        },
      },
    )

    const legendForTrack = (trackId: string) =>
      wrapper.get(`[data-legend-track-id="${trackId}"] .waveform-chart__legend`)

    expect(legendForTrack('frame-0').attributes('data-position')).toBe('top')
    expect(legendForTrack('frame-0').attributes('data-orientation')).toBe('horizontal')
    expect(legendForTrack('frame-1').attributes('data-position')).toBe('bottom-right')
    expect(legendForTrack('frame-1').attributes('data-orientation')).toBe('vertical')

    await wrapper.setProps({
      legend: {
        position: 'left',
        orientation: 'vertical',
        trackPositions: { 'frame-0': 'top', 'frame-1': 'bottom-right', 'frame-2': 'bottom' },
      },
    })
    expect(legendForTrack('frame-0').attributes('data-orientation')).toBe('vertical')

    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(legendForTrack('frame-2').attributes('data-position')).toBe('bottom')
    expect(legendForTrack('frame-2').attributes('data-orientation')).toBe('vertical')
    expect(legendForTrack('frame-3').attributes('data-position')).toBe('left')
    expect(legendForTrack('frame-3').attributes('data-orientation')).toBe('vertical')
  })

  it('applies a configurable alpha background to every visible legend', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 4 }, (_, index) => ({
          id: `series-${index}`,
          trackId: `frame-${Math.floor(index / 2)}`,
          name: `series ${index}`,
          data: {
            kind: 'points',
            points: [
              { x: 0, y: index },
              { x: 1, y: index + 1 },
            ],
          },
        })),
      },
      {
        grid: { rowCount: 2, columnCount: 1 },
        legend: { backgroundColor: 'rgba(14, 165, 233, 0.25)' },
      },
    )

    const legendPanels = wrapper.findAll('.waveform-legend__panel')
    expect(legendPanels).toHaveLength(2)
    legendPanels.forEach((panel) => {
      expect(panel.attributes('style')).toContain('background-color: rgba(14, 165, 233, 0.25)')
    })

    await wrapper.setProps({ legend: { backgroundColor: '' } })
    wrapper.findAll('.waveform-legend__panel').forEach((panel) => {
      expect(panel.attributes('style')).toContain('background-color: rgba(255, 255, 255, 0.7)')
    })
  })

  it('keeps legends display-only unless interaction is explicitly enabled', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      grid: { rowCount: 1, columnCount: 1 },
    })

    const items = wrapper.findAll('.waveform-chart__legend-item')
    expect(items).toHaveLength(2)
    expect(items.every((item) => item.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('.waveform-legend__panel').classes()).not.toContain(
      'waveform-legend__panel--interactive',
    )
    expect(wrapper.emitted('update:hidden-series-ids')).toBeUndefined()
  })

  it('toggles series, axes, tooltips, and annotations from an interactive legend', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      annotations: [{ id: 'high-note', seriesId: 'high', x: 15, y: 1500, text: '高值' }],
      grid: { rowCount: 1, columnCount: 1 },
      legend: { interactive: true },
      overlayMode: 'multi-axis',
    })

    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(2)
    expect(wrapper.find('[data-annotation-id="high-note"]').exists()).toBe(true)
    const annotationLayer = wrapper.get('.waveform-annotation-layer').element
    const legendLayer = wrapper.get('.waveform-chart__legend-layer').element
    expect(
      annotationLayer.compareDocumentPosition(legendLayer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const highLegendItem = wrapper.findAll('.waveform-chart__legend-item')[1]
    expect(highLegendItem.attributes('aria-pressed')).toBe('true')

    await highLegendItem.trigger('click')
    await flushPromises()

    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(1)
    expect(wrapper.find('[data-annotation-id="high-note"]').exists()).toBe(false)
    expect(wrapper.findAll('.waveform-chart__legend-item')[1].classes()).toContain('is-hidden')
    expect(wrapper.findAll('.waveform-chart__legend-item')[1].attributes('aria-pressed')).toBe(
      'false',
    )
    expect(wrapper.emitted('update:hidden-series-ids')?.at(-1)).toEqual([['high']])
    expect(wrapper.emitted('series-visibility-change')?.at(-1)).toEqual([
      { seriesId: 'high', visible: false, hiddenSeriesIds: ['high'] },
    ])

    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const overlayWidth = Number(overlay.attributes('width'))
    const overlayHeight = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: overlayHeight }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: overlayWidth / 2,
        clientY: overlayHeight / 2,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__tooltip-series')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__tooltip-series').text()).toContain('低量程')

    await wrapper.findAll('.waveform-chart__legend-item')[1].trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(2)
    expect(wrapper.find('[data-annotation-id="high-note"]').exists()).toBe(true)
    expect(wrapper.emitted('series-visibility-change')?.at(-1)).toEqual([
      { seriesId: 'high', visible: true, hiddenSeriesIds: [] },
    ])
  })

  it('waits for controlled visibility updates and preserves unknown controlled IDs', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      grid: { rowCount: 1, columnCount: 1 },
      hiddenSeriesIds: ['high', 'temporarily-absent'],
      legend: { interactive: true },
    })

    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])
    await wrapper.findAll('.waveform-chart__legend-item')[0].trigger('click')
    expect(wrapper.emitted('update:hidden-series-ids')?.at(-1)).toEqual([
      ['high', 'temporarily-absent', 'low'],
    ])
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])

    await wrapper.setProps({ hiddenSeriesIds: ['low'] })
    await flushPromises()
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['high'])
  })

  it('retains uncontrolled visibility by stable ID and clears removed IDs', async () => {
    const original = visibilitySeries()
    const wrapper = await mountSizedChart(original, {
      grid: { rowCount: 1, columnCount: 1 },
      legend: { interactive: true },
    })
    await wrapper.findAll('.waveform-chart__legend-item')[1].trigger('click')

    const reversed: WaveformData = {
      kind: 'series',
      series: [...(original.kind === 'series' ? original.series : [])].reverse(),
    }
    await wrapper.setProps({ data: reversed })
    await flushPromises()
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])

    await wrapper.setProps({
      data: {
        kind: 'series',
        series: original.kind === 'series' ? [original.series[0]!] : [],
      },
    })
    await flushPromises()
    await wrapper.setProps({ data: original })
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(2)
  })

  it('keeps a recoverable legend and stops chart interaction when every series is hidden', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      defaultHiddenSeriesIds: ['low', 'high'],
      grid: { rowCount: 1, columnCount: 1 },
      legend: { interactive: true },
      overlayMode: 'multi-axis',
    })

    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__axis')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__overlay')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__legend-item')).toHaveLength(2)
    expect(wrapper.get('.waveform-track__no-visible-series').text()).toBe('暂无可见曲线')

    await wrapper.findAll('.waveform-chart__legend-item')[0].trigger('click')
    await flushPromises()
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__overlay--independent')).toHaveLength(1)
  })

  it('closes an annotation editor when its series is hidden from the legend', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      grid: { rowCount: 1, columnCount: 1 },
      legend: { interactive: true },
    })
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const overlayWidth = Number(overlay.attributes('width'))
    const overlayHeight = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: overlayHeight }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: overlayWidth * 0.75,
        clientY: overlayHeight / 2,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-annotation-editor').exists()).toBe(true)

    const controller = wrapper.getComponent(WaveformChartView).props('controller') as unknown as {
      annotationInteraction: { editorDraft: { value: { annotation: { seriesId: string } } | null } }
    }
    const draftSeriesId = controller.annotationInteraction.editorDraft.value?.annotation.seriesId
    const item = wrapper
      .findAll('.waveform-chart__legend-item')
      .find((legendItem) =>
        legendItem.text().includes(draftSeriesId === 'high' ? '高量程' : '低量程'),
      )
    expect(item).toBeDefined()
    await item!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.waveform-annotation-editor').exists()).toBe(false)
  })

  it('renders independent cells with separate x axes and overlays', async () => {
    const wrapper = await mountSizedChart(gridSeries(4), {
      displayMode: 'independent',
      grid: { rowCount: 2, columnCount: 2 },
    })

    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(4)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(4)
    expect(wrapper.findAll('.waveform-chart__overlay--independent')).toHaveLength(4)
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstTop = Number(tracks[0].attributes('data-track-top'))
    const secondRowTop = Number(tracks[2].attributes('data-track-top'))
    const firstHeight = Number(tracks[0].attributes('data-track-height'))
    expect(secondRowTop).toBeGreaterThan(firstTop + firstHeight + 20)
  })

  it('reserves horizontal clearance for Y-axis labels in multi-column grids', async () => {
    for (const displayMode of ['independent', 'separated', 'compact'] as const) {
      const wrapper = await mountSizedChart(gridSeries(4), {
        displayMode,
        grid: { rowCount: 2, columnCount: 2 },
      })
      const tracks = wrapper.findAll('.waveform-chart__track')
      const firstLeft = Number(tracks[0].attributes('data-track-left') ?? 0)
      const firstWidth = Number(tracks[0].attributes('data-track-width'))
      const secondLeft = Number(tracks[1].attributes('data-track-left'))
      const labelX = Number(tracks[1].attributes('data-y-axis-label-x'))

      expect(secondLeft - (firstLeft + firstWidth)).toBeGreaterThanOrEqual(Math.abs(labelX) + 16)
      expect(tracks[1].find('.waveform-chart__y-axis-label-bg').exists()).toBe(true)
    }
  })
})

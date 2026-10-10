import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { resizeObservers } from '@tests/support/setup'
import { mountSizedChart, visibilitySeries } from '@tests/support/waveformChart'

describe('all hidden series axes and grids', () => {
  for (const displayMode of ['independent', 'separated', 'compact'] as const) {
    for (const overlayMode of ['single-axis', 'multi-axis'] as const) {
      it.each([800, 360])(
        `retains data ticks and grids after legend clicks (${displayMode}, ${overlayMode}, %ipx)`,
        async (width) => {
          const wrapper = await mountSizedChart(visibilitySeries(), {
            displayMode,
            overlayMode,
            layoutPreset: 'edge-compact',
            legend: { interactive: true },
            grid: { rowCount: 1, columnCount: 1 },
          })
          resizeObservers.at(-1)?.resize(width, 360)
          await flushPromises()
          const ticks = () =>
            wrapper.findAll('.waveform-chart__axis .tick text').map((tick) => tick.text())
          const endpoints = () =>
            wrapper.findAll('.waveform-chart__axis-endpoint').map((label) => label.text())
          const originalTicks = ticks()
          const originalEndpoints = endpoints()
          const gridCounts = () =>
            ['horizontal', 'vertical'].map(
              (direction) => wrapper.findAll(`[data-grid-direction="${direction}"]`).length,
            )
          const originalGridCounts = gridCounts()

          for (const item of wrapper.findAll('.waveform-chart__legend-item')) {
            await item.trigger('click')
          }
          await flushPromises()

          expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(0)
          expect(originalTicks.length).toBeGreaterThan(0)
          expect(ticks()).toEqual(originalTicks)
          expect(endpoints()).toEqual(originalEndpoints)
          expect(gridCounts()).toEqual(originalGridCounts)
          expect(originalGridCounts.every((count) => count > 0)).toBe(true)
          expect(wrapper.findAll('.waveform-chart__overlay')).toHaveLength(0)

          await wrapper.findAll('.waveform-chart__legend-item')[0].trigger('click')
          await flushPromises()
          expect(wrapper.get('.waveform-chart__line').attributes('data-series-id')).toBe('low')
        },
      )
    }
  }

  it('respects fixed domains and disabled grid directions when all series are hidden', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      hiddenSeriesIds: ['low', 'high', 'mid'],
      initialXDomain: [5, 15],
      yDomain: [-50, 50],
      axes: { y: { nice: false } },
      grid: {
        rowCount: 1,
        columnCount: 1,
        trackLines: { 'shared-frame': { horizontal: false, vertical: true } },
      },
    })
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toContain('5')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toContain('15')
    const yTicks = wrapper.findAll('.waveform-chart__axis--y .tick text').map((tick) => tick.text())
    expect(yTicks[0]).toContain('50')
    expect(yTicks.at(-1)).toContain('50')
    expect(wrapper.findAll('[data-grid-direction="horizontal"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-grid-direction="vertical"]').length).toBeGreaterThan(0)
  })
})

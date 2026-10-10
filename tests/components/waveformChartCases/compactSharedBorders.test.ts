import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'

describe('compact shared frame borders', () => {
  it.each(['default', 'edge-compact'] as const)(
    'draws each horizontal boundary once with %s layout',
    async (layoutPreset) => {
      const wrapper = await mountSizedChart(gridSeries(6), {
        layoutPreset,
        displayMode: 'compact',
        grid: { rowCount: 3, columnCount: 2 },
        frameStyle: { borderWidth: 2, borderStyle: 'dashed' },
      })
      try {
        const frames = wrapper.findAll('.waveform-chart__plot-frame')
        expect(frames.map((frame) => frame.element.tagName.toLowerCase())).toEqual([
          'rect',
          'rect',
          'path',
          'path',
          'path',
          'path',
        ])
        frames.forEach((frame, index) => {
          expect(frame.attributes('stroke-width')).toBe('2')
          expect(frame.attributes('stroke-dasharray')).toBe('6 4')
          if (index < 2) return
          const inset = layoutPreset === 'edge-compact' ? 1 : 0
          const right = Number(frame.attributes('width')) + inset
          const bottom = Number(frame.attributes('height')) + inset
          // Two sides and one bottom edge; the preceding frame owns the top edge.
          expect(frame.attributes('d')).toBe(
            `M ${inset} ${inset} V ${bottom} H ${right} V ${inset}`,
          )
        })
        await wrapper.setProps({ displayMode: 'separated' })
        await flushPromises()
        expect(
          wrapper
            .findAll('.waveform-chart__plot-frame')
            .every((frame) => frame.element.tagName.toLowerCase() === 'rect'),
        ).toBe(true)
      } finally {
        wrapper.unmount()
      }
    },
  )

  it('preserves a complete border for a single frame and every new page', async () => {
    const wrapper = await mountSizedChart(gridSeries(4), {
      displayMode: 'compact',
      layoutPreset: 'edge-compact',
      grid: { rowCount: 2, columnCount: 1 },
    })
    try {
      await wrapper.get('.ant-pagination-next button').trigger('click')
      expect(
        wrapper
          .findAll('.waveform-chart__plot-frame')
          .map((frame) => frame.element.tagName.toLowerCase()),
      ).toEqual(['rect', 'path'])
      await wrapper.setProps({ data: gridSeries(1), grid: { rowCount: 1, columnCount: 1 } })
      expect(wrapper.get('.waveform-chart__plot-frame').element.tagName.toLowerCase()).toBe('rect')
    } finally {
      wrapper.unmount()
    }
  })

  it('preserves the top border after an empty slot', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'compact',
      layoutPreset: 'edge-compact',
      grid: {
        rowCount: 3,
        columnCount: 1,
        trackOrder: ['channel-0', 'empty', 'channel-1'],
        hideEmptyTracks: false,
      },
    })
    try {
      expect(
        wrapper
          .findAll('.waveform-chart__plot-frame')
          .map((frame) => frame.element.tagName.toLowerCase()),
      ).toEqual(['rect', 'rect'])
      await wrapper.setProps({
        grid: {
          rowCount: 3,
          columnCount: 1,
          trackOrder: ['channel-0', 'empty', 'channel-1'],
          hideEmptyTracks: true,
        },
      })
      expect(
        wrapper
          .findAll('.waveform-chart__plot-frame')
          .map((frame) => frame.element.tagName.toLowerCase()),
      ).toEqual(['rect', 'path'])
    } finally {
      wrapper.unmount()
    }
  })

  it('retains complete borders when an incomplete row has a different width', async () => {
    const wrapper = await mountSizedChart(gridSeries(3), {
      displayMode: 'compact',
      grid: { rowCount: 2, columnCount: 2, fillIncompleteLastRow: true },
    })
    try {
      expect(
        wrapper
          .findAll('.waveform-chart__plot-frame')
          .map((frame) => frame.element.tagName.toLowerCase()),
      ).toEqual(['rect', 'rect', 'rect'])
    } finally {
      wrapper.unmount()
    }
  })
})

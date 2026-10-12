import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'

describe('compact shared frame borders', () => {
  it('continues placeholder numbering on subsequent pages', async () => {
    const wrapper = await mountSizedChart(gridSeries(3), {
      displayMode: 'compact',
      grid: { rowCount: 2, columnCount: 1 },
      frameNumber: 1,
    })
    try {
      await wrapper.get('.ant-pagination-next button').trigger('click')
      const empty = wrapper.get('.waveform-chart__track--empty')
      expect(empty.get('.waveform-chart__watermark').text()).toBe('4')
      await wrapper.setProps({ frameNumber: 'Frame' })
      expect(empty.get('.waveform-chart__watermark').text()).toBe('Frame-4')
    } finally {
      wrapper.unmount()
    }
  })

  it.each([800, 320])('fills the tenth slot with an empty frame at %s px', async (width) => {
    const wrapper = await mountSizedChart(gridSeries(9), {
      width,
      displayMode: 'compact',
      grid: { rowCount: 5, columnCount: 2 },
      frameNumber: 1,
      frameStyle: { borderColor: '#123456', borderWidth: 2, borderStyle: 'dashed' },
    })
    try {
      expect(wrapper.findAll('.waveform-chart__plot-frame')).toHaveLength(10)
      const empty = wrapper.get('.waveform-chart__track--empty')
      const frame = empty.get('.waveform-chart__plot-frame')
      expect(frame.attributes('stroke')).toBe('#123456')
      expect(frame.attributes('stroke-width')).toBe('2')
      expect(frame.attributes('stroke-dasharray')).toBe('6 4')
      expect(empty.find('.waveform-chart__axis--y').exists()).toBe(false)
      expect(empty.findAll('line[data-grid-direction="horizontal"]').length).toBeGreaterThan(0)
      expect(empty.findAll('line[data-grid-direction="vertical"]').length).toBeGreaterThan(0)
      expect(empty.get('.waveform-chart__watermark').text()).toBe('10')
      await wrapper.setProps({ cleanView: true })
      expect(empty.find('.waveform-chart__grid').exists()).toBe(false)
      expect(empty.find('.waveform-chart__watermark').exists()).toBe(false)
      await wrapper.setProps({ cleanView: false, frameNumber: undefined })
      expect(empty.find('.waveform-chart__watermark').exists()).toBe(false)
      expect(empty.find('.waveform-chart__axis--x').exists()).toBe(true)
      await wrapper.setProps({ displayMode: 'independent' })
      expect(wrapper.findAll('.waveform-chart__plot-frame')).toHaveLength(10)
      await wrapper.setProps({
        displayMode: 'compact',
        grid: { rowCount: 5, columnCount: 2, fillIncompleteLastRow: true },
      })
      expect(wrapper.findAll('.waveform-chart__plot-frame')).toHaveLength(9)
      expect(wrapper.find('.waveform-chart__track--empty').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

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
          'path',
          'path',
          'path',
          'path',
          'rect',
          'rect',
        ])
        frames.forEach((frame, index) => {
          expect(frame.attributes('stroke-width')).toBe('2')
          expect(frame.attributes('stroke-dasharray')).toBe('6 4')
          if (index >= 4) return
          const inset = layoutPreset === 'edge-compact' ? 1 : 0
          const right = Number(frame.attributes('width')) + inset
          const bottom = Number(frame.attributes('height')) + inset
          // Two sides and one top edge; the following frame owns the bottom edge.
          expect(frame.attributes('d')).toBe(`M${inset},${bottom}V${inset}H${right}V${bottom}`)
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
      ).toEqual(['path', 'rect'])
      await wrapper.setProps({ data: gridSeries(1), grid: { rowCount: 1, columnCount: 1 } })
      expect(wrapper.get('.waveform-chart__plot-frame').element.tagName.toLowerCase()).toBe('rect')
    } finally {
      wrapper.unmount()
    }
  })

  it('shares borders across empty slots and retains trailing placeholders', async () => {
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
      ).toEqual(['path', 'path', 'rect'])
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
      ).toEqual(['path', 'path', 'rect'])
    } finally {
      wrapper.unmount()
    }
  })

  it('lets the wider final row own the shared boundary across both upper frames', async () => {
    const wrapper = await mountSizedChart(gridSeries(3), {
      displayMode: 'compact',
      grid: { rowCount: 2, columnCount: 2, fillIncompleteLastRow: true },
    })
    try {
      expect(
        wrapper
          .findAll('.waveform-chart__plot-frame')
          .map((frame) => frame.element.tagName.toLowerCase()),
      ).toEqual(['path', 'path', 'rect'])
    } finally {
      wrapper.unmount()
    }
  })
})

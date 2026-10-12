import { describe, expect, it } from 'vitest'
import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'

describe('separated empty frames', () => {
  it.each([800, 320])('fills a 5 by 2 grid at %s px', async (width) => {
    const wrapper = await mountSizedChart(gridSeries(9), {
      width,
      displayMode: 'separated',
      grid: { rowCount: 5, columnCount: 2 },
      frameNumber: 1,
      frameStyle: { borderColor: '#123456', backgroundColor: 'white' },
    })
    try {
      const tracks = wrapper.findAll('.waveform-chart__track')
      expect(tracks).toHaveLength(10)
      expect(wrapper.find('.waveform-chart__grid-slot-placeholder').exists()).toBe(false)
      const empty = wrapper.get('.waveform-chart__track--empty')
      expect(empty.get('.waveform-chart__plot-frame').attributes('stroke')).toBe('#123456')
      expect(empty.get('.waveform-chart__plot-background').attributes('fill')).toBe('white')
      expect(empty.get('.waveform-chart__watermark').text()).toBe('10')
      for (const direction of ['horizontal', 'vertical']) {
        expect(empty.findAll(`line[data-grid-direction="${direction}"]`).length).toBeGreaterThan(0)
      }
      expect(empty.find('.waveform-chart__line').exists()).toBe(false)
      expect(empty.find('.waveform-chart__axis--y').exists()).toBe(false)
      expect(tracks[7].find('.waveform-chart__axis--x').exists()).toBe(true)
      expect(tracks[8].find('.waveform-chart__axis--x').exists()).toBe(true)
      expect(Number(empty.attributes('data-track-top'))).toBeGreaterThan(
        Number(tracks[7].attributes('data-track-top')) +
          Number(tracks[7].attributes('data-track-height')),
      )
      await wrapper.setProps({ cleanView: true })
      expect(empty.find('.waveform-chart__grid').exists()).toBe(false)
      expect(empty.find('.waveform-chart__watermark').exists()).toBe(false)
      await wrapper.setProps({ cleanView: false, frameNumber: undefined })
      expect(empty.find('.waveform-chart__watermark').exists()).toBe(false)
      await wrapper.setProps({ grid: { rowCount: 5, columnCount: 2, fillIncompleteLastRow: true } })
      expect(wrapper.findAll('.waveform-chart__plot-frame')).toHaveLength(9)
      expect(wrapper.find('.waveform-chart__track--empty').exists()).toBe(false)
      await wrapper.setProps({ data: gridSeries(0) })
      expect(wrapper.find('.waveform-chart__track').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('continues numbering on the final page', async () => {
    const wrapper = await mountSizedChart(gridSeries(3), {
      displayMode: 'separated',
      grid: { rowCount: 2, columnCount: 1 },
      frameNumber: 1,
    })
    try {
      await wrapper.get('.ant-pagination-next button').trigger('click')
      expect(wrapper.get('.waveform-chart__track--empty .waveform-chart__watermark').text()).toBe(
        '4',
      )
    } finally {
      wrapper.unmount()
    }
  })
})

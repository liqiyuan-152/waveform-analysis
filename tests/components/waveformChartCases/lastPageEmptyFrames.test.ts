import { describe, expect, it } from 'vitest'

import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'

describe('last page empty frames', () => {
  it.each([320, 800])(
    'fills unused independent slots with styled frames at %s px',
    async (width) => {
      const wrapper = await mountSizedChart(gridSeries(5), {
        width,
        displayMode: 'independent',
        layoutPreset: 'edge-compact',
        grid: { rowCount: 2, columnCount: 2 },
        frameNumber: 1,
        initialXDomain: [-2, 3],
        frameStyle: { borderColor: '#123456', borderWidth: 2, backgroundColor: '#fff' },
      })
      try {
        await wrapper.get('[aria-label="下一页"]').trigger('click')
        expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(4)
        expect(wrapper.find('.waveform-chart__grid-slot-placeholder').exists()).toBe(false)
        expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(1)
        const emptyTracks = wrapper.findAll('.waveform-chart__track--empty')
        expect(emptyTracks).toHaveLength(3)
        for (const [index, empty] of emptyTracks.entries()) {
          expect(empty.get('.waveform-chart__plot-frame').attributes('stroke')).toBe('#123456')
          expect(empty.get('.waveform-chart__plot-frame').attributes('stroke-width')).toBe('2')
          expect(
            empty.get('.waveform-chart__plot-frame').attributes('stroke-dasharray'),
          ).toBeUndefined()
          expect(empty.get('.waveform-chart__plot-background').attributes('fill')).toBe('#fff')
          expect(empty.get('.waveform-chart__watermark').text()).toBe(String(index + 6))
          expect(empty.find('.waveform-chart__axis--y').exists()).toBe(false)
          expect(empty.find('.waveform-chart__overlay').exists()).toBe(false)
          expect(empty.findAll('line[data-grid-direction="vertical"]').length).toBeGreaterThan(0)
          expect(empty.get('.waveform-chart__axis-endpoint--start').text()).toBe('-2000')
          expect(empty.get('.waveform-chart__axis-endpoint--end').text()).toBe('3000')
        }
        await wrapper.setProps({ cleanView: true })
        expect(wrapper.findAll('.waveform-chart__plot-frame')).toHaveLength(4)
        expect(
          wrapper.findAll('.waveform-chart__watermark').some((element) => element.isVisible()),
        ).toBe(false)
        await wrapper.setProps({
          cleanView: false,
          grid: { rowCount: 2, columnCount: 2, fillIncompleteLastRow: true },
        })
        await wrapper.get('[aria-label="下一页"]').trigger('click')
        expect(wrapper.findAll('.waveform-chart__plot-frame')).toHaveLength(1)
        expect(wrapper.find('.waveform-chart__track--empty').exists()).toBe(false)
      } finally {
        wrapper.unmount()
      }
    },
  )
})

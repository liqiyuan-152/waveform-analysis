import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

function geometry(track: { attributes: (name: string) => string | undefined }) {
  return {
    left: Number(track.attributes('data-track-left')),
    top: Number(track.attributes('data-track-top')),
    width: Number(track.attributes('data-track-width')),
    height: Number(track.attributes('data-track-height')),
  }
}

describe('WaveformChart incomplete grid rows', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'fills an incomplete two by two row in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(gridSeries(3), {
        displayMode,
        grid: { rowCount: 2, columnCount: 2, fillIncompleteLastRow: true },
      })
      const tracks = wrapper.findAll('.waveform-chart__track')
      const first = geometry(tracks[0]!)
      const last = geometry(tracks[2]!)

      expect(tracks).toHaveLength(3)
      expect(wrapper.findAll('.waveform-chart__track--empty')).toHaveLength(0)
      expect(wrapper.findAll('.waveform-chart__grid-slot-placeholder')).toHaveLength(0)
      expect(last.left).toBe(0)
      expect(last.width).toBeGreaterThan(first.width * 1.8)
      expect(last.top).toBeGreaterThan(first.top)
      if (displayMode === 'independent') {
        const overlays = wrapper.findAll('.waveform-chart__overlay--independent')
        expect(overlays).toHaveLength(3)
        expect(Number(overlays[2]?.attributes('width'))).toBe(last.width)
      } else {
        expect(wrapper.findAll('.waveform-chart__overlay--shared')).toHaveLength(1)
      }
    },
  )

  it('removes unused one-column rows and redistributes chart height', async () => {
    const base = await mountSizedChart(gridSeries(3), {
      displayMode: 'independent',
      grid: { rowCount: 4, columnCount: 1 },
    })
    const filled = await mountSizedChart(gridSeries(3), {
      displayMode: 'independent',
      grid: { rowCount: 4, columnCount: 1, fillIncompleteLastRow: true },
    })
    const baseFirst = geometry(base.findAll('.waveform-chart__track')[0]!)
    const filledTracks = filled.findAll('.waveform-chart__track')
    const filledFirst = geometry(filledTracks[0]!)
    const filledLast = geometry(filledTracks[2]!)

    expect(filledTracks).toHaveLength(3)
    expect(filledFirst.height).toBeGreaterThan(baseFirst.height)
    expect(filledLast.top + filledLast.height).toBeGreaterThan(baseFirst.height * 3)
  })

  it('keeps the final two tracks evenly distributed in a two by three grid', async () => {
    const wrapper = await mountSizedChart(gridSeries(5), {
      displayMode: 'separated',
      grid: { rowCount: 2, columnCount: 3, fillIncompleteLastRow: true },
    })
    const tracks = wrapper.findAll('.waveform-chart__track').map(geometry)

    expect(tracks).toHaveLength(5)
    expect(tracks[3]?.left).toBe(0)
    expect(tracks[3]?.width).toBeCloseTo(tracks[4]?.width ?? 0)
    expect(tracks[4]?.left).toBeGreaterThan((tracks[3]?.width ?? 0) + 1)
  })

  it('keeps full pages unchanged and fills a partial second page', async () => {
    const data = gridSeries(5)
    const standard = await mountSizedChart(data, {
      displayMode: 'separated',
      grid: { rowCount: 2, columnCount: 2 },
    })
    const filled = await mountSizedChart(data, {
      displayMode: 'separated',
      grid: { rowCount: 2, columnCount: 2, fillIncompleteLastRow: true },
    })
    const standardFirstPage = standard.findAll('.waveform-chart__track').map(geometry)
    expect(filled.findAll('.waveform-chart__track').map(geometry)).toEqual(standardFirstPage)

    await filled.get('.ant-pagination-next button').trigger('click')
    await flushPromises()
    const secondPage = filled.findAll('.waveform-chart__track').map(geometry)
    expect(secondPage).toHaveLength(1)
    expect(secondPage[0]?.left).toBe(0)
    expect(secondPage[0]?.width).toBeGreaterThan(standardFirstPage[0]?.width ?? 0)
  })
})

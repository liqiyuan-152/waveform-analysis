import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart track order', () => {
  const points = (offset: number) => ({
    kind: 'points' as const,
    points: [
      { x: 0, y: offset },
      { x: 1, y: offset + 1 },
    ],
  })
  const orderedSeries = (trackIds: string[]) => ({
    kind: 'series' as const,
    series: trackIds.map((trackId, index) => ({
      id: trackId,
      trackId,
      name: trackId,
      data: points(index + 1),
    })),
  })
  const mergedFourTrackSeries = () => ({
    kind: 'series' as const,
    series: [
      { id: 'frame-1-a', trackId: 'frame-1', name: 'frame-1-a', data: points(1) },
      { id: 'frame-1-b', trackId: 'frame-1', name: 'frame-1-b', data: points(2) },
      { id: 'frame-3', trackId: 'frame-3', name: 'frame-3', data: points(3) },
      { id: 'frame-4', trackId: 'frame-4', name: 'frame-4', data: points(4) },
    ],
  })

  it('keeps a merged source slot empty without adding legend or tooltip data', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'frame-1-a',
            trackId: 'frame-1',
            name: '合并前通道',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1 },
                { x: 1, y: 2 },
              ],
            },
          },
          {
            id: 'frame-1-b',
            trackId: 'frame-1',
            name: '合并后通道',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 3 },
                { x: 1, y: 4 },
              ],
            },
          },
          {
            id: 'frame-3',
            trackId: 'frame-3',
            name: '后续通道',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 5 },
                { x: 1, y: 6 },
              ],
            },
          },
        ],
      },
      {
        displayMode: 'separated',
        grid: { rowCount: 3, trackOrder: ['frame-1', 'frame-2', 'frame-3'] },
      },
    )
    const trackIds = () =>
      wrapper.findAll('.waveform-chart__track').map((track) => track.attributes('data-track-id'))

    expect(trackIds()).toEqual(['frame-1', 'frame-2', 'frame-3'])
    expect(wrapper.findAll('.waveform-chart__track--empty')).toHaveLength(1)
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['frame-1-a', 'frame-1-b', 'frame-3'])
    expect(wrapper.findAll('.waveform-chart__legend')).toHaveLength(1)

    const overlay = wrapper.get('.waveform-chart__overlay--shared')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 356, clientY: 150, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__tooltip-series')).toHaveLength(3)
    expect(wrapper.get('.waveform-chart__tooltip').text()).not.toContain('frame-2')
    expect(wrapper.findAll('.waveform-chart__crosshair line')).toHaveLength(2)
  })

  it('keeps incremental watermarks stable when empty ordered tracks are hidden', async () => {
    const wrapper = await mountSizedChart(mergedFourTrackSeries(), {
      frameNumber: 1,
      grid: {
        rowCount: 2,
        columnCount: 1,
        hideEmptyTracks: true,
        trackOrder: ['frame-1', 'frame-2', 'frame-3', 'frame-4'],
      },
    })

    expect(
      wrapper.findAll('.waveform-chart__track').map((track) => track.attributes('data-track-id')),
    ).toEqual(['frame-1', 'frame-3'])
    expect(
      wrapper.findAll('.waveform-chart__watermark').map((watermark) => watermark.text()),
    ).toEqual(['1', '3'])

    await wrapper.get('.ant-pagination-next button').trigger('click')

    expect(
      wrapper.findAll('.waveform-chart__track').map((track) => track.attributes('data-track-id')),
    ).toEqual(['frame-4'])
    expect(
      wrapper.findAll('.waveform-chart__watermark').map((watermark) => watermark.text()),
    ).toEqual(['4'])
  })

  it('uses stable track IDs for explicit frame watermark overrides', async () => {
    const wrapper = await mountSizedChart(mergedFourTrackSeries(), {
      frameNumber: 1,
      frameNumbers: { 'frame-1': 'A', 'frame-3': 'C', 'frame-4': 'D' },
      grid: {
        rowCount: 2,
        columnCount: 1,
        hideEmptyTracks: true,
        trackOrder: ['frame-1', 'frame-2', 'frame-3', 'frame-4'],
      },
    })

    expect(
      wrapper.findAll('.waveform-chart__watermark').map((watermark) => watermark.text()),
    ).toEqual(['A', 'C'])

    await wrapper.get('.ant-pagination-next button').trigger('click')

    expect(
      wrapper.findAll('.waveform-chart__watermark').map((watermark) => watermark.text()),
    ).toEqual(['D'])
  })

  it('keeps the existing incremental watermark fallback when frame mappings are absent', async () => {
    const wrapper = await mountSizedChart(orderedSeries(['frame-1', 'frame-2']), {
      frameNumber: 7,
      grid: { rowCount: 2, columnCount: 1 },
    })

    expect(
      wrapper.findAll('.waveform-chart__watermark').map((watermark) => watermark.text()),
    ).toEqual(['7', '8'])
  })

  it('appends data tracks absent from trackOrder in input order', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'later-a',
            trackId: 'later-a',
            name: 'later-a',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1 },
                { x: 1, y: 2 },
              ],
            },
          },
          {
            id: 'frame-1',
            trackId: 'frame-1',
            name: 'frame-1',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 3 },
                { x: 1, y: 4 },
              ],
            },
          },
          {
            id: 'later-b',
            trackId: 'later-b',
            name: 'later-b',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 5 },
                { x: 1, y: 6 },
              ],
            },
          },
        ],
      },
      { grid: { rowCount: 2, columnCount: 2, trackOrder: ['frame-2', 'frame-1'] } },
    )

    expect(
      wrapper.findAll('.waveform-chart__track').map((track) => track.attributes('data-track-id')),
    ).toEqual(['frame-2', 'frame-1', 'later-a', 'later-b'])
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'reclaims merged empty slots in %s mode when incomplete rows fill',
    async (displayMode) => {
      const wrapper = await mountSizedChart(mergedFourTrackSeries(), {
        displayMode,
        grid: {
          rowCount: 4,
          columnCount: 1,
          fillIncompleteLastRow: true,
          trackOrder: ['frame-1', 'frame-2', 'frame-3', 'frame-4'],
        },
      })
      const tracks = wrapper.findAll('.waveform-chart__track')
      const heights = tracks.map((track) => Number(track.attributes('data-track-height')))

      expect(tracks.map((track) => track.attributes('data-track-id'))).toEqual([
        'frame-1',
        'frame-3',
        'frame-4',
      ])
      expect(wrapper.findAll('.waveform-chart__track--empty')).toHaveLength(0)
      expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(4)
      expect(heights[0]).toBeCloseTo(heights[1] ?? Number.NaN)
      expect(heights[1]).toBeCloseTo(heights[2] ?? Number.NaN)
      expect(wrapper.findAll('.waveform-chart__legend')).toHaveLength(1)
      expect(wrapper.get('.waveform-chart__legend').text()).not.toContain('frame-2')
    },
  )

  it('reclaims only the current page without pulling tracks from the next page', async () => {
    const wrapper = await mountSizedChart(
      orderedSeries(['frame-1', 'frame-3', 'frame-4', 'frame-5', 'frame-6', 'frame-7', 'frame-8']),
      {
        grid: {
          rowCount: 4,
          columnCount: 1,
          fillIncompleteLastRow: true,
          trackOrder: [
            'frame-1',
            'frame-2',
            'frame-3',
            'frame-4',
            'frame-5',
            'frame-6',
            'frame-7',
            'frame-8',
          ],
        },
      },
    )
    const trackIds = () =>
      wrapper.findAll('.waveform-chart__track').map((track) => track.attributes('data-track-id'))

    expect(trackIds()).toEqual(['frame-1', 'frame-3', 'frame-4'])
    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(trackIds()).toEqual(['frame-5', 'frame-6', 'frame-7', 'frame-8'])
    expect(wrapper.emitted('page-change')?.at(-1)).toEqual([2, 2])
  })

  it('retains ordered empty slots when incomplete rows do not fill', async () => {
    const wrapper = await mountSizedChart(orderedSeries(['frame-1', 'frame-3', 'frame-4']), {
      grid: {
        rowCount: 4,
        columnCount: 1,
        fillIncompleteLastRow: false,
        trackOrder: ['frame-1', 'frame-2', 'frame-3', 'frame-4'],
      },
    })

    expect(
      wrapper.findAll('.waveform-chart__track').map((track) => track.attributes('data-track-id')),
    ).toEqual(['frame-1', 'frame-2', 'frame-3', 'frame-4'])
    expect(wrapper.findAll('.waveform-chart__track--empty')).toHaveLength(1)
  })

  it('keeps an entirely empty page addressable when incomplete rows fill', async () => {
    const wrapper = await mountSizedChart(
      orderedSeries(['frame-1', 'frame-2', 'frame-3', 'frame-4']),
      {
        grid: {
          rowCount: 4,
          columnCount: 1,
          fillIncompleteLastRow: true,
          trackOrder: [
            'frame-1',
            'frame-2',
            'frame-3',
            'frame-4',
            'frame-5',
            'frame-6',
            'frame-7',
            'frame-8',
          ],
        },
      },
    )

    await wrapper.get('.ant-pagination-next button').trigger('click')

    expect(wrapper.findAll('.waveform-chart__track--empty')).toHaveLength(4)
    expect(wrapper.emitted('page-change')?.at(-1)).toEqual([2, 2])
    expect(wrapper.get('.ant-pagination-item-active').text()).toBe('2')
  })
})

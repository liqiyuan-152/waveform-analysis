import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart track order', () => {
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
})

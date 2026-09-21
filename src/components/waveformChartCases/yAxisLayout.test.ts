import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { resizeObservers } from '../../test/setup'

import { mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart Y-axis layout', () => {
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

  it('reserves the rendered endpoint label width across tracks, pages, and resizes', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: ['WE_2M', 'IP_VV_2M', 'SX2_7_07', 'BT1_2M'].map((name, index) => ({
          id: name,
          name,
          unit: 'V',
          data: {
            kind: 'points' as const,
            points: [
              { x: 0, y: -0.7434 - index },
              { x: 1, y: -0.3434 - index },
            ],
          },
        })),
      },
      {
        axes: { y: { lineVisible: false, nice: false } },
        grid: { rowCount: 1, columnCount: 1 },
      },
    )
    const firstTrack = wrapper.get('.waveform-chart__track')

    expect(wrapper.attributes('data-chart-left-margin')).toBe('100')
    expect(firstTrack.attributes('data-y-axis-label-x')).toBe('-90')
    expect(firstTrack.findAll('.waveform-chart__axis--y .tick text').at(-1)?.text()).toBe(
      '(V) -0.3434',
    )

    resizeObservers.at(-1)?.resize(520, 280)
    await flushPromises()
    expect(wrapper.attributes('data-chart-left-margin')).toBe('100')
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe('-90')

    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.attributes('data-chart-left-margin')).toBe('100')
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe('-90')
    expect(wrapper.get('.waveform-chart__axis--y').findAll('.tick text').at(-1)?.text()).toBe(
      '(V) -1.3434',
    )
  })

  it('measures the compact-row unit label after omitting the top endpoint', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: ['first', 'second'].map((id) => ({
          id,
          name: id,
          unit: 'V',
          data: {
            kind: 'points' as const,
            points: [
              { x: 0, y: 0.12345 },
              { x: 1, y: 100 },
            ],
          },
        })),
      },
      {
        displayMode: 'compact',
        axes: { y: { nice: false } },
        grid: { rowCount: 2, columnCount: 1 },
      },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')

    expect(wrapper.attributes('data-chart-left-margin')).toBe('93')
    expect(tracks[1]?.attributes('data-y-axis-label-x')).toBe('-83')
    expect(tracks[1]?.findAll('.waveform-chart__axis--y .tick text').at(-1)?.text()).toBe(
      '(V) 75.031',
    )
  })
})

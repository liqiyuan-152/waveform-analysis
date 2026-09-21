import { describe, expect, it } from 'vitest'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart x domain strategy', () => {
  it('expands automatic x domains without changing source seconds', async () => {
    const data = {
      kind: 'points' as const,
      points: [
        { x: 0, y: 0 },
        { x: 4.999999, y: 1 },
      ],
    }
    const wrapper = await mountSizedChart(data, {
      timeUnit: 'ms',
      xDomainStrategy: { type: 'nice', bounds: 'end' },
    })

    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('5000')
    expect(data.points[1]?.x).toBe(4.999999)
  })

  it('keeps explicit initial x domains exact by default', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 123, y: 0 },
          { x: 456, y: 1 },
        ],
      },
      {
        timeUnit: 's',
        initialXDomain: [120, 460],
        xDomainStrategy: { type: 'nice' },
      },
    )

    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('120')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('460')
  })

  it('keeps explicit per-track initial x domains exact by default', async () => {
    const wrapper = await mountSizedChart(gridSeries(1), {
      displayMode: 'independent',
      initialXDomains: { 'channel-0': [0, 4.999999] },
      xDomainStrategy: { type: 'nice', bounds: 'end' },
    })

    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('4999.999')
  })

  it('includes an explicit shared initial x domain when requested', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 4.999999, y: 1 },
        ],
      },
      {
        initialXDomain: [0, 4.999999],
        xDomainStrategy: {
          type: 'nice',
          bounds: 'end',
          tickCount: 10,
          includeExplicit: true,
        },
      },
    )

    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('5000')
  })

  it('includes explicit per-track initial x domains in independent mode', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
      initialXDomains: {
        'channel-0': [0, 4.999999],
        'channel-1': [10, 14.999999],
      },
      xDomainStrategy: { type: 'nice', bounds: 'end', tickCount: 10, includeExplicit: true },
    })

    const tracks = wrapper.findAll('.waveform-chart__track')
    expect(tracks[0]?.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(tracks[0]?.get('.waveform-chart__axis-endpoint--end').text()).toBe('5000')
    expect(tracks[1]?.get('.waveform-chart__axis-endpoint--start').text()).toBe('10000')
    expect(tracks[1]?.get('.waveform-chart__axis-endpoint--end').text()).toBe('15000')
  })

  it('keeps an explicit viewport wider than the data and leaves uncovered time blank', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 1 },
        ],
      },
      { timeUnit: 's', initialXDomain: [-5, 20] },
    )

    const track = wrapper.get('.waveform-chart__track')
    const width = Number(track.attributes('data-track-width'))
    const path = track.get('.waveform-chart__line').attributes('d') ?? ''
    const xCoordinates = Array.from(path.matchAll(/(?:M|L)([\d.-]+)/g)).map((match) =>
      Number(match[1]),
    )

    expect(track.get('.waveform-chart__axis-endpoint--start').text()).toBe('-5')
    expect(track.get('.waveform-chart__axis-endpoint--end').text()).toBe('20')
    expect(xCoordinates.length).toBeGreaterThan(0)
    expect(Math.min(...xCoordinates)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xCoordinates)).toBeLessThanOrEqual(width)
  })

  it('applies independent explicit viewports per track, including empty time regions', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'first',
            name: '第一轨',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 10, y: 1 },
              ],
            },
          },
          {
            id: 'second',
            name: '第二轨',
            data: {
              kind: 'points',
              points: [
                { x: 100, y: 0 },
                { x: 110, y: 1 },
              ],
            },
          },
        ],
      },
      {
        displayMode: 'independent',
        grid: { rowCount: 1, columnCount: 2 },
        timeUnit: 's',
        initialXDomains: { first: [-5, 20], second: [95, 120] },
      },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    expect(tracks[0]?.get('.waveform-chart__axis-endpoint--start').text()).toBe('-5')
    expect(tracks[0]?.get('.waveform-chart__axis-endpoint--end').text()).toBe('20')
    expect(tracks[1]?.get('.waveform-chart__axis-endpoint--start').text()).toBe('95')
    expect(tracks[1]?.get('.waveform-chart__axis-endpoint--end').text()).toBe('120')
    expect(tracks[0]?.find('.waveform-chart__line').exists()).toBe(true)
    expect(tracks[1]?.find('.waveform-chart__line').exists()).toBe(true)
  })
})

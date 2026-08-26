import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { type WaveformData } from '../waveform'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('keeps other independent tracks unchanged when one data window is replaced', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const originalEndpoints = wrapper
      .findAll('.waveform-chart__axis-endpoint--end')
      .map((endpoint) => endpoint.text())

    await wrapper.setProps({
      data: {
        kind: 'series',
        series: [
          {
            id: 'channel-0',
            name: '通道 1',
            data: {
              kind: 'points',
              points: [
                { x: 0.25, y: 0 },
                { x: 0.75, y: 1 },
              ],
            },
          },
          {
            id: 'channel-1',
            name: '通道 2',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1 },
                { x: 1, y: 2 },
              ],
            },
          },
        ],
      },
    })
    await flushPromises()

    const nextEndpoints = wrapper
      .findAll('.waveform-chart__axis-endpoint--end')
      .map((endpoint) => endpoint.text())
    expect(nextEndpoints[0]).not.toBe(originalEndpoints[0])
    expect(nextEndpoints[1]).toBe(originalEndpoints[1])
  })

  it('rebuilds cached domains only when the data reference changes', async () => {
    const firstData: WaveformData = {
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const wrapper = await mountSizedChart(firstData)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1000')

    firstData.points.push({ x: 2, y: 2 })
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1000')

    await wrapper.setProps({ data: { ...firstData, points: [...firstData.points] } })
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2000')
  })

  it('keeps controlled annotations when replacing the loaded data window', async () => {
    const annotations = [
      { id: 'window-note', seriesId: 'series-0', x: 0.5, y: 0.5, text: '窗口标注' },
    ]
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { annotations },
    )
    expect(wrapper.find('[data-annotation-id="window-note"]').exists()).toBe(true)

    await wrapper.setProps({
      data: {
        kind: 'points',
        points: [
          { x: 2, y: 0 },
          { x: 3, y: 1 },
        ],
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-annotation-id="window-note"]').exists()).toBe(false)
    expect(annotations).toEqual([
      { id: 'window-note', seriesId: 'series-0', x: 0.5, y: 0.5, text: '窗口标注' },
    ])

    await wrapper.setProps({
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-annotation-id="window-note"]').exists()).toBe(true)
  })

  it('renders named multi-channel paths as independent tracks by default', async () => {
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: [
        {
          name: 'BT2_2M',
          unit: 'T',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 2 },
            ],
          },
        },
        {
          name: 'BT1_2M',
          unit: 'T',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1 },
              { x: 2, y: 3 },
            ],
          },
        },
      ],
    })
    const paths = wrapper.findAll('.waveform-chart__line')

    expect(paths).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__svg')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__overlay--independent')).toHaveLength(2)
    expect(paths[0].attributes('stroke')).toBe('#0960bd')
    expect(paths[1].attributes('stroke')).toBe('#ff7f0e')
    expect(paths[0].attributes('data-series-name')).toBe('BT2_2M')
    const yAxisLabels = wrapper.findAll('.waveform-chart__y-axis-label')
    expect(yAxisLabels.map((label) => label.text())).toEqual(['BT2_2M', 'BT1_2M'])
    expect(
      wrapper
        .findAll('.waveform-chart__axis--y .tick text')
        .map((label) => label.text())
        .some((label) => label.includes('(T)')),
    ).toBe(true)
    expect(yAxisLabels.map((label) => label.attributes('fill'))).toEqual(['#0960bd', '#ff7f0e'])
    const labelX = Number(
      yAxisLabels[0].attributes('transform')?.match(/^translate\(([-\d.]+),/)?.[1],
    )
    expect(labelX).toBeLessThan(-46)
    expect(Number(wrapper.get('.waveform-chart__y-axis-label-bg').attributes('x'))).toBe(
      labelX - 6,
    )
    expect(yAxisLabels.every((label) => !label.text().includes('(T)'))).toBe(true)
    expect(wrapper.findAll('.waveform-chart__track-label')).toHaveLength(0)
    expect(
      wrapper.findAll('.waveform-chart__axis-endpoint--end').map((item) => item.text()),
    ).toEqual(['1000', '2000'])
  })

  it('keeps the zero Y-axis label on upper compact tracks', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'first',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            name: 'second',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1 },
                { x: 1, y: 2 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact' },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstAxisTicks = tracks[0].findAll('.waveform-chart__axis--y .tick')
    const zeroTicks = firstAxisTicks.filter((tick) => Number(tick.text()) === 0)
    const firstTrackHeight = Number(tracks[0].attributes('data-track-height'))
    const zeroTickY = Number(
      zeroTicks[0].attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)?.[1],
    )

    expect(zeroTicks).toHaveLength(1)
    expect(Math.abs(zeroTickY - firstTrackHeight)).toBeLessThanOrEqual(1)
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'shows a non-zero Y-axis start value once in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [
            {
              name: 'first',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 0.11 },
                  { x: 1, y: 0.89 },
                ],
              },
            },
            {
              name: 'second',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 4 },
                  { x: 1, y: 5 },
                ],
              },
            },
          ],
        },
        { displayMode },
      )

      const firstTrack = wrapper.findAll('.waveform-chart__track')[0]
      const firstTrackHeight = Number(firstTrack.attributes('data-track-height'))
      const startTicks = firstTrack.findAll('.waveform-chart__axis--y .tick').filter((tick) => {
        const match = tick.attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)
        return match ? Math.abs(Number(match[1]) - firstTrackHeight) <= 1 : false
      })

      expect(startTicks).toHaveLength(1)
      expect(Number(startTicks[0].text())).toBe(0)
    },
  )

  it.each(['independent', 'separated'] as const)(
    'shows the Y-axis end value once on every track in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [
            {
              name: 'first',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 0.11 },
                  { x: 1, y: 0.89 },
                ],
              },
            },
            {
              name: 'second',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 4.11 },
                  { x: 1, y: 4.89 },
                ],
              },
            },
          ],
        },
        { displayMode },
      )

      const expectedEndValues = [1, 5]
      wrapper.findAll('.waveform-chart__track').forEach((track, index) => {
        const endTicks = track.findAll('.waveform-chart__axis--y .tick').filter((tick) => {
          const match = tick.attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)
          return match ? Math.abs(Number(match[1])) <= 1 : false
        })

        expect(endTicks).toHaveLength(1)
        expect(Number(endTicks[0].text())).toBe(expectedEndValues[index])
      })
    },
  )
})

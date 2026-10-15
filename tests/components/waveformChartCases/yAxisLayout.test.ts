import { resizeChart } from '@tests/support/setup'
import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { type DOMWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { measureYAxisTextWidth } from '@/components/core/yAxisTextWidth'

import { mountSizedChart } from '@tests/support/waveformChart'

function expectCompleteTickClearance(track: Pick<DOMWrapper<Element>, 'get' | 'findAll'>) {
  const band = track.get('.waveform-chart__y-axis-label-bg')
  const bandRight = Number(band.attributes('x')) + Number(band.attributes('width'))
  track
    .findAll('.waveform-chart__axis--y .tick text')
    .filter((tick) => tick.attributes('display') !== 'none')
    .forEach((tick) => {
      const tickLeft = Number(tick.attributes('x')) - measureYAxisTextWidth(tick.text())
      expect(tickLeft - bandRight).toBeGreaterThanOrEqual(2)
    })
}

describe('WaveformChart Y-axis layout', () => {
  it('reserves the longest tick label including the top unit across resizes', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'channel',
            name: '通道',
            unit: 'long-unit-name',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -2 },
                { x: 1, y: 2 },
              ],
            },
          },
        ],
      },
      { axes: { y: { nice: false } } },
    )
    try {
      const assertTitlePosition = () => {
        const track = wrapper.get('.waveform-chart__track')
        const title = track.get('.waveform-chart__y-axis-label')
        const titleX = Number(title.attributes('transform')?.match(/^translate\(([-\d.]+),/)?.[1])
        expect(titleX).toBe(Number(track.attributes('data-y-axis-label-x')))
        expect(titleX + 10).toBeLessThan(-7)
        const background = track.get('.waveform-chart__y-axis-label-bg')
        expect(Number(background.attributes('x'))).toBe(titleX - 10)
        expect(Number(background.attributes('width'))).toBe(20)
        expectCompleteTickClearance(track)
      }
      assertTitlePosition()
      resizeChart(375, 280)
      await flushPromises()
      assertTitlePosition()
    } finally {
      wrapper.unmount()
    }
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'aligns Y endpoint labels with their ticks without an offset in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'points',
          points: [
            { x: 0, y: -20 },
            { x: 1, y: 80 },
          ],
        },
        { displayMode, yDomain: [-20, 80], axes: { y: { nice: false } } },
      )
      try {
        const assertLabelAlignment = () => {
          const track = wrapper.get('.waveform-chart__track')
          const height = Number(track.attributes('data-track-height'))
          const ticks = track.findAll('.waveform-chart__axis--y .tick')
          expect(ticks.map((tick) => tick.text())).toEqual(['-20', '5', '30', '55', '80'])
          const bottomPosition = Number(
            ticks[0].attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)?.[1],
          )
          expect(bottomPosition).toBeCloseTo(height + 0.5)
          for (const tick of ticks) {
            const text = tick.get('text')
            expect(text.attributes('y')).toBeUndefined()
            expect(text.attributes('dy')).toBe('0')
            expect(text.attributes('dominant-baseline')).toBe('central')
          }
          expect(ticks.every((tick) => tick.get('line').attributes('y2') === undefined)).toBe(true)
        }
        assertLabelAlignment()
        resizeChart(520, 280)
        await flushPromises()
        assertLabelAlignment()
        await wrapper.setProps({ cleanView: true, yDomain: [-40, 160] })
        await flushPromises()
        const track = wrapper.get('.waveform-chart__track')
        const bottom = track.get('.waveform-chart__axis--y .tick text')
        expect(bottom.text()).toBe('-40')
        expect(bottom.attributes()).toMatchObject({
          dy: '0',
        })
        expect(bottom.attributes('dominant-baseline')).toBe('central')
        expect(bottom.attributes('y')).toBeUndefined()
      } finally {
        wrapper.unmount()
      }
    },
  )

  it('aligns endpoint labels like ordinary ticks on both left and right Y axes', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [-10, -1000].map((minimum, index) => ({
          id: `series-${index}`,
          name: `series-${index}`,
          trackId: 'shared',
          data: {
            kind: 'points' as const,
            points: [
              { x: 0, y: minimum },
              { x: 1, y: -minimum },
            ],
          },
        })),
      },
      { overlayMode: 'multi-axis', axes: { y: { nice: false } } },
    )
    try {
      const axes = wrapper.findAll('.waveform-chart__axis--y')
      expect(axes).toHaveLength(2)
      for (const axis of axes) {
        expect(axis.get('.tick text').attributes()).toMatchObject({
          dy: '0',
        })
        for (const text of axis.findAll('.tick text')) {
          expect(text.attributes('dy')).toBe('0')
          expect(text.attributes('dominant-baseline')).toBe('central')
          expect(text.attributes('y')).toBeUndefined()
        }
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('applies the configured Y-axis split number', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 3 },
          { x: 1, y: 97 },
        ],
      },
      { axes: { y: { splitNumber: 5, maximumTickVisible: false, minimumTickVisible: false } } },
    )

    expect(
      wrapper
        .get('.waveform-chart__axis--y')
        .findAll('.tick text')
        .map((tick) => tick.text()),
    ).toEqual(['0', '20', '40', '60', '80', '100'])
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

    const initialMargin = wrapper.get('.waveform-chart').attributes('data-chart-left-margin')
    const initialLabelX = firstTrack.attributes('data-y-axis-label-x')
    expectCompleteTickClearance(firstTrack)
    expect(firstTrack.findAll('.waveform-chart__axis--y .tick text').at(-1)?.text()).toBe(
      '(V) -0.3434',
    )

    resizeChart(520, 280)
    await flushPromises()
    expect(wrapper.get('.waveform-chart').attributes('data-chart-left-margin')).toBe(initialMargin)
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe(
      initialLabelX,
    )
    expectCompleteTickClearance(wrapper.get('.waveform-chart__track'))

    await wrapper.get('[aria-label="下一页"]').trigger('click')
    expect(wrapper.get('.waveform-chart').attributes('data-chart-left-margin')).toBe(initialMargin)
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe(
      initialLabelX,
    )
    expectCompleteTickClearance(wrapper.get('.waveform-chart__track'))
    expect(wrapper.get('.waveform-chart__axis--y').findAll('.tick text').at(-1)?.text()).toBe(
      '(V) -1.3434',
    )
  })

  it('keeps compact-row units on the visible maximum label', async () => {
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

    expect(tracks[1]?.attributes('data-y-axis-label-x')).toBe(
      tracks[0]?.attributes('data-y-axis-label-x'),
    )
    tracks.forEach(expectCompleteTickClearance)
    const labels = tracks[1]!.findAll('.waveform-chart__axis--y .tick text')
    expect(labels.at(-1)?.text()).toBe('(V) 100')
    expect(labels.at(-1)?.attributes('display')).toBeUndefined()
    expect(labels.at(-2)?.text()).not.toContain('(V)')
    expect(labels.at(-2)?.attributes('display')).toBeUndefined()
  })
})

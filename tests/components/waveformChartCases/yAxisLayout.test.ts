import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { resizeObservers } from '@tests/support/setup'

import { mountSizedChart } from '@tests/support/waveformChart'

describe('WaveformChart Y-axis layout', () => {
  it('places channel names beside nearby ticks without reserving the top unit width', async () => {
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
        expect(titleX).toBeGreaterThan(Number(track.attributes('data-y-axis-label-x')))
        expect(titleX + 10).toBeLessThan(-7)
        const background = track.get('.waveform-chart__y-axis-label-bg')
        expect(Number(background.attributes('x'))).toBe(titleX - 10)
        expect(Number(background.attributes('width'))).toBe(20)
      }
      assertTitlePosition()
      resizeObservers.at(-1)?.resize(375, 280)
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
          expect(ticks[0].get('text').attributes()).toMatchObject({
            dy: '0',
            'dominant-baseline': 'text-after-edge',
          })
          expect(ticks[0].get('text').attributes('y')).toBeUndefined()
          expect(
            ticks.slice(1).every((tick) => tick.get('text').attributes('y') === undefined),
          ).toBe(true)
          expect(
            ticks.slice(1, displayMode === 'compact' ? -1 : undefined).every((tick) => {
              const text = tick.get('text')
              return (
                text.attributes('dy') === '0.32em' &&
                text.attributes('dominant-baseline') === undefined
              )
            }),
          ).toBe(true)
          if (displayMode === 'compact') {
            expect(ticks.at(-1)!.get('text').attributes()).toMatchObject({
              dy: '0',
              'dominant-baseline': 'text-before-edge',
            })
          }
          expect(ticks.every((tick) => tick.get('line').attributes('y2') === undefined)).toBe(true)
        }
        assertLabelAlignment()
        resizeObservers.at(-1)?.resize(520, 280)
        await flushPromises()
        assertLabelAlignment()
        await wrapper.setProps({ cleanView: true, yDomain: [-40, 160] })
        await flushPromises()
        const track = wrapper.get('.waveform-chart__track')
        const bottom = track.get('.waveform-chart__axis--y .tick text')
        expect(bottom.text()).toBe('-40')
        expect(bottom.attributes()).toMatchObject({
          dy: '0',
          'dominant-baseline': 'text-after-edge',
        })
        expect(bottom.attributes('y')).toBeUndefined()
      } finally {
        wrapper.unmount()
      }
    },
  )

  it('bottom-aligns the lowest label with its tick on both left and right Y axes', async () => {
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
          'dominant-baseline': 'text-after-edge',
        })
        expect(axis.get('.tick text').attributes('y')).toBeUndefined()
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

    expect(wrapper.attributes('data-chart-left-margin')).toBe('108')
    expect(firstTrack.attributes('data-y-axis-label-x')).toBe('-94')
    expect(firstTrack.findAll('.waveform-chart__axis--y .tick text').at(-1)?.text()).toBe(
      '(V) -0.3434',
    )

    resizeObservers.at(-1)?.resize(520, 280)
    await flushPromises()
    expect(wrapper.attributes('data-chart-left-margin')).toBe('108')
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe('-94')

    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.attributes('data-chart-left-margin')).toBe('108')
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe('-94')
    expect(wrapper.get('.waveform-chart__axis--y').findAll('.tick text').at(-1)?.text()).toBe(
      '(V) -1.3434',
    )
  })

  it('reserves room for compact-row units while keeping the top endpoint', async () => {
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

    expect(wrapper.attributes('data-chart-left-margin')).toBe('101')
    expect(tracks[1]?.attributes('data-y-axis-label-x')).toBe('-87')
    expect(tracks[1]?.findAll('.waveform-chart__axis--y .tick text').at(-1)?.text()).toBe('(V) 100')
  })
})

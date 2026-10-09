import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import WaveformChart from '@/components/WaveformChart.vue'
import { gridSeries } from '@tests/support/waveformChart'

const props = {
  width: 800,
  height: 500,
  layoutPreset: 'edge-compact' as const,
  plotMargin: { top: 0, bottom: 44 },
  title: { text: 'shot: #1001', textStyle: { fontSize: 18, fontWeight: 700 } },
  xLabel: 'Time(ms)',
}

describe('edge-compact actual plot bounds', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'includes the last axis band in the bottom budget for multiple rows/columns in %s mode',
    async (displayMode) => {
      const wrapper = mount(WaveformChart, {
        props: {
          ...props,
          data: gridSeries(4),
          displayMode,
          grid: { rowCount: 2, columnCount: 2 },
        },
      })
      await flushPromises()
      const tracks = wrapper.findAll('.waveform-chart__track')
      const svgHeight = Number(wrapper.get('.waveform-chart__svg').attributes('height'))
      const plotBottom = (index: number) =>
        Number(tracks[index].attributes('data-track-top')) +
        Number(tracks[index].attributes('data-track-height'))
      for (const index of [2, 3]) expect(svgHeight - plotBottom(index)).toBeCloseTo(44)
      expect(
        Number(wrapper.get('.waveform-chart__x-label').attributes('y')) - plotBottom(3),
      ).toBeCloseTo(32)
      const betweenRows = Number(tracks[2].attributes('data-track-top')) - plotBottom(0)
      expect(betweenRows).toBeCloseTo(
        displayMode === 'independent' ? 44 : displayMode === 'separated' ? 16 : 0,
      )
      await wrapper.setProps({ plotMargin: { top: 0, bottom: 70 } })
      expect(svgHeight - plotBottom(3)).toBeCloseTo(70)
    },
  )

  it('does not credit an absent last-row axis for separated trailing empty frames', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        ...props,
        data: gridSeries(1),
        displayMode: 'separated',
        grid: { rowCount: 3, trackOrder: ['channel-0', 'empty-1', 'empty-2'] },
      },
    })
    await flushPromises()
    const tracks = wrapper.findAll('.waveform-chart__track')
    expect(tracks).toHaveLength(3)
    expect(tracks[0].find('.waveform-chart__axis--x').exists()).toBe(true)
    expect(tracks[2].find('.waveform-chart__axis--x').exists()).toBe(false)
    const bottom =
      Number(tracks[2].attributes('data-track-top')) +
      Number(tracks[2].attributes('data-track-height'))
    expect(Number(wrapper.get('.waveform-chart__svg').attributes('height')) - bottom).toBeCloseTo(
      44,
    )
    // The earlier track's axis still has its own 30px band plus the 16px separated-row gap.
    expect(
      Number(tracks[1].attributes('data-track-top')) -
        Number(tracks[0].attributes('data-track-height')),
    ).toBeCloseTo(46)
  })

  it('preserves intermediate axis bands when different columns end on different rows', async () => {
    const input = gridSeries(2)
    const wrapper = mount(WaveformChart, {
      props: {
        ...props,
        data: input,
        displayMode: 'separated',
        grid: {
          rowCount: 3,
          columnCount: 2,
          trackOrder: ['channel-0', 'empty-a', 'empty-b', 'empty-c', 'empty-d', 'channel-1'],
        },
      },
    })
    await flushPromises()
    const tracks = wrapper.findAll('.waveform-chart__track')
    const last = tracks.at(-1)!
    const bottom =
      Number(last.attributes('data-track-top')) + Number(last.attributes('data-track-height'))
    expect(Number(wrapper.get('.waveform-chart__svg').attributes('height')) - bottom).toBeCloseTo(
      44,
    )
    expect(
      Number(tracks[2].attributes('data-track-top')) -
        Number(tracks[0].attributes('data-track-height')),
    ).toBeCloseTo(46)
    expect(Number(wrapper.get('.waveform-chart__x-label').attributes('y')) - bottom).toBeCloseTo(32)
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'budgets a filled incomplete last row in %s mode',
    async (displayMode) => {
      const wrapper = mount(WaveformChart, {
        props: {
          ...props,
          data: gridSeries(3),
          displayMode,
          grid: { rowCount: 3, columnCount: 2, fillIncompleteLastRow: true },
        },
      })
      await flushPromises()
      const last = wrapper.findAll('.waveform-chart__track').at(-1)!
      const bottom =
        Number(last.attributes('data-track-top')) + Number(last.attributes('data-track-height'))
      expect(Number(wrapper.get('.waveform-chart__svg').attributes('height')) - bottom).toBeCloseTo(
        44,
      )
    },
  )

  it('does not add a bottom-band credit in clean view and restores it on return', async () => {
    const wrapper = mount(WaveformChart, {
      props: { ...props, data: gridSeries(1), grid: { rowCount: 1 }, cleanView: true },
    })
    await flushPromises()
    const bottomGap = () =>
      Number(wrapper.get('.waveform-chart__svg').attributes('height')) -
      Number(wrapper.get('.waveform-chart__track').attributes('data-track-height'))
    expect(bottomGap()).toBeCloseTo(74)
    expect(wrapper.find('.waveform-chart__x-label').exists()).toBe(false)
    await wrapper.setProps({ cleanView: false })
    expect(bottomGap()).toBeCloseTo(44)
    await wrapper.setProps({ layoutPreset: 'default' })
    expect(bottomGap()).toBeCloseTo(74)
  })

  it.each([320, 800])(
    'uses the same plot budget above narrow/desktop pagination at width %s',
    async (width) => {
      const wrapper = mount(WaveformChart, {
        props: { ...props, width, data: gridSeries(2), grid: { rowCount: 1 } },
      })
      await flushPromises()
      const area = Number(wrapper.attributes('data-title-area-height'))
      const svgHeight = Number(wrapper.get('.waveform-chart__svg').attributes('height'))
      const bottom = Number(wrapper.get('.waveform-chart__track').attributes('data-track-height'))
      expect(svgHeight).toBeCloseTo(500 - area - (width <= 520 ? 40 : 16))
      expect(svgHeight - bottom).toBeCloseTo(44)
      expect(Number(wrapper.get('.waveform-chart__x-label').attributes('y')) - bottom).toBeCloseTo(
        32,
      )
    },
  )

  it.each([true, false])(
    'contains the highest Y tick and exponent with title=%s at top=0',
    async (withTitle) => {
      const wrapper = mount(WaveformChart, {
        props: {
          ...props,
          title: withTitle ? props.title : undefined,
          data: gridSeries(1),
          yDomain: [0, 30000],
          grid: { rowCount: 1 },
        },
      })
      await flushPromises()
      const texts = wrapper.findAll('.waveform-chart__axis--y .tick text')
      const highest = texts.at(-1)!
      expect(highest.text()).toBe('E+04 3')
      expect(highest.attributes('dominant-baseline')).toBe('text-before-edge')
      expect(highest.attributes('dy')).toBe('0')
      expect(texts[0].attributes('dominant-baseline')).toBe('text-after-edge')
      expect(wrapper.attributes('data-plot-margin-top')).toBe('0')
      expect(wrapper.get('.waveform-chart__track').attributes('data-track-top')).toBe('0')
      expect(getComputedStyle(wrapper.element).overflow).toBe('hidden')
      await wrapper.setProps({ layoutPreset: 'default' })
      await flushPromises()
      expect(
        wrapper
          .findAll('.waveform-chart__axis--y .tick text')
          .at(-1)!
          .attributes('dominant-baseline'),
      ).toBeUndefined()
    },
  )
})

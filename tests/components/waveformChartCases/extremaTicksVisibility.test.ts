import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { WaveformAxesOptions, WaveformData } from '@/index'
import { mountSizedChart } from '@tests/support/waveformChart'

type Chart = Awaited<ReturnType<typeof mountSizedChart>>
const data: WaveformData = {
  kind: 'points',
  points: [
    { x: 0, y: 12.345 },
    { x: 1, y: 78.901 },
  ],
}
const extrema = (chart: Chart, side: 'minimum' | 'maximum') =>
  chart.findAll(`[data-${side}-tick]`).map((tick) => Number(tick.attributes('data-tick-value')))
const domain = (chart: Chart) => {
  const axis = chart.get('.waveform-track__axis--y')
  return ['min', 'max'].map((side) => Number(axis.attributes(`data-label-domain-${side}`)))
}
const ticks = (chart: Chart) =>
  chart
    .findAll('.waveform-track__axis--y .tick')
    .map((tick) => Number(tick.attributes('data-tick-value')))

describe('extrema tick visibility API', () => {
  it('keeps a constant extremum when either independent option is enabled', async () => {
    const chart = await mountSizedChart({ kind: 'points', points: [{ x: 0, y: 12.345 }] })
    for (const [maximumTickVisible, minimumTickVisible] of [
      [true, false],
      [false, true],
      [true, true],
      [false, false],
    ] as const) {
      await chart.setProps({ axes: { y: { maximumTickVisible, minimumTickVisible } } })
      await flushPromises()
      expect(extrema(chart, 'maximum')).toEqual(maximumTickVisible ? [12.345] : [])
      expect(extrema(chart, 'minimum')).toEqual(minimumTickVisible ? [12.345] : [])
      expect(ticks(chart).filter((value) => value === 12.345)).toHaveLength(
        maximumTickVisible || minimumTickVisible ? 1 : 0,
      )
    }
    chart.unmount()
  })
  it.each(['independent', 'separated', 'compact'] as const)(
    'defaults to visible without padding and toggles reactively in %s',
    async (displayMode) => {
      const y: NonNullable<WaveformAxesOptions['y']> = {
        upperPaddingEnabled: false,
        lowerPaddingEnabled: false,
      }
      const chart = await mountSizedChart(data, {
        displayMode,
        axes: { y },
        grid: { rowCount: 1 },
      })
      expect(extrema(chart, 'minimum')).toEqual([12.345])
      expect(extrema(chart, 'maximum')).toEqual([78.901])
      expect(chart.get('[data-maximum-tick] text').attributes('display')).toBeUndefined()
      expect(chart.get('[data-maximum-tick] line').attributes('display')).toBeUndefined()
      const originalDomain = domain(chart)
      chart.vm.setViewportDomain([0.2, 0.8])
      await flushPromises()
      const endpoints = () =>
        chart.findAll('.waveform-chart__axis-endpoint').map((label) => Number(label.text()))
      const zoomedEndpoints = endpoints()
      for (const [maximumTickVisible, minimumTickVisible] of [
        [false, true],
        [true, false],
        [false, false],
        [true, true],
      ] as const) {
        await chart.setProps({ axes: { y: { ...y, maximumTickVisible, minimumTickVisible } } })
        await flushPromises()
        expect(extrema(chart, 'minimum')).toEqual(minimumTickVisible ? [12.345] : [])
        expect(extrema(chart, 'maximum')).toEqual(maximumTickVisible ? [78.901] : [])
        expect(domain(chart)).toEqual(originalDomain)
        endpoints().forEach((value, index) =>
          expect(value).toBeCloseTo(zoomedEndpoints[index]!, 10),
        )
      }
      await chart.setProps({
        axes: { y: { ...y, maximumTickVisible: false, minimumTickVisible: false } },
      })
      await flushPromises()
      expect(extrema(chart, 'minimum')).toEqual([])
      expect(extrema(chart, 'maximum')).toEqual([])
      expect(ticks(chart)).not.toContain(12.345)
      expect(ticks(chart)).not.toContain(78.901)
      expect(domain(chart)).toEqual(originalDomain)
      endpoints().forEach((value, index) => expect(value).toBeCloseTo(zoomedEndpoints[index]!, 10))
      expect(chart.props('data')).toEqual(data)
      expect(chart.emitted('zoom-reset')).toBeUndefined()
      await chart.setProps({ axes: { y } })
      await flushPromises()
      expect(extrema(chart, 'minimum')).toEqual([12.345])
      expect(extrema(chart, 'maximum')).toEqual([78.901])
      expect(domain(chart)).toEqual(originalDomain)
      endpoints().forEach((value, index) => expect(value).toBeCloseTo(zoomedEndpoints[index]!, 10))
      chart.unmount()
    },
  )

  it('does not expand fixed ranges and only marks extrema inside the domain', async () => {
    const chart = await mountSizedChart(data, { yDomain: [0, 50], axes: { y: { nice: false } } })
    expect(domain(chart)).toEqual([0, 50])
    expect(extrema(chart, 'minimum')).toEqual([12.345])
    expect(extrema(chart, 'maximum')).toEqual([])
    await chart.setProps({ yDomain: [20, 100] })
    await flushPromises()
    expect(domain(chart)).toEqual([20, 100])
    expect(extrema(chart, 'minimum')).toEqual([])
    expect(extrema(chart, 'maximum')).toEqual([78.901])
    await chart.setProps({
      axes: { y: { nice: false, maximumTickVisible: false, minimumTickVisible: false } },
    })
    await flushPromises()
    expect(domain(chart)).toEqual([20, 100])
    expect(extrema(chart, 'maximum')).toEqual([])
    chart.unmount()
  })

  it('preserves ordinary ticks that equal extrema and restores hidden nearby strokes', async () => {
    const chart = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 100 },
        ],
      },
      { axes: { y: { nice: false, upperPaddingRatio: 0.001 } }, grid: { rowCount: 1 } },
    )
    const upper = () =>
      chart
        .findAll('.waveform-track__axis--y .tick')
        .find((tick) => tick.attributes('data-tick-value') === '100.1')!
    expect(upper()).toBeUndefined()
    await chart.setProps({
      axes: {
        y: {
          nice: false,
          upperPaddingRatio: 0.001,
          maximumTickVisible: false,
          minimumTickVisible: false,
        },
      },
    })
    await flushPromises()
    expect(upper().get('text').attributes('display')).toBe('none')
    await chart.setProps({
      axes: { y: { nice: false, maximumTickVisible: false, minimumTickVisible: false } },
    })
    await flushPromises()
    expect(ticks(chart)).toEqual([0, 25, 50, 75, 100])
    expect(extrema(chart, 'minimum')).toEqual([])
    expect(extrema(chart, 'maximum')).toEqual([])
    chart.unmount()
  })

  it('uses full normalized data even when SVG geometry is reduced', async () => {
    const chart = await mountSizedChart(
      {
        kind: 'points',
        points: Array.from({ length: 2000 }, (_, x) => ({
          x,
          y: x === 123 ? -123.456 : x === 987 ? 789.123 : 0,
        })),
      },
      { rendering: { sampling: { mode: 'auto', maxPointCount: 10 } } },
    )
    expect(extrema(chart, 'minimum')).toEqual([-123.456])
    expect(extrema(chart, 'maximum')).toEqual([789.123])
    chart.unmount()
  })

  it('removes extrema when every series is hidden and restores them on reveal', async () => {
    const chart = await mountSizedChart({
      kind: 'series',
      series: [{ id: 'channel', name: 'Channel', data }],
    })
    expect(extrema(chart, 'minimum')).toEqual([12.345])
    await chart.setProps({ hiddenSeriesIds: ['channel'] })
    await flushPromises()
    expect(extrema(chart, 'minimum')).toEqual([])
    expect(extrema(chart, 'maximum')).toEqual([])
    expect(chart.find('.waveform-track__axis--y').exists()).toBe(true)
    await chart.setProps({ hiddenSeriesIds: [] })
    await flushPromises()
    expect(extrema(chart, 'minimum')).toEqual([12.345])
    expect(extrema(chart, 'maximum')).toEqual([78.901])
    chart.unmount()
  })
})

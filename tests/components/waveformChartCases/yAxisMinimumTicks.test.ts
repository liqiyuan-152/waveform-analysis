import { resizeChart } from '@tests/support/setup'
import { describe, expect, it } from 'vitest'

import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'
import { updateMaximumTickVisibility } from '@/components/rendering/yAxisTickVisibility'
import type { WaveformData } from '@/types'

const data: WaveformData = {
  kind: 'points',
  points: [
    { x: 0, y: 20 },
    { x: 1, y: 80 },
  ],
}
const minima = (w: Awaited<ReturnType<typeof mountSizedChart>>) =>
  w.findAll('[data-minimum-tick]').map((tick) => Number(tick.attributes('data-tick-value')))

describe('Y-axis actual minimum ticks', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'shows extrema independently of padding in %s and restores ordinary ticks when disabled',
    async (displayMode) => {
      const w = await mountSizedChart(data, {
        displayMode,
        grid: { rowCount: 1 },
        axes: { y: { nice: false, lowerPaddingEnabled: true } },
      })
      expect(minima(w)).toEqual([20])
      expect(w.get('[data-minimum-tick] text').attributes('display')).toBeUndefined()
      expect(w.get('[data-maximum-tick]').attributes('data-tick-value')).toBe('80')
      await w.setProps({
        axes: { y: { nice: false, lowerPaddingRatio: 0.1, upperPaddingRatio: 0.1 } },
      })
      await flushVueChartUpdates()
      expect(minima(w)).toEqual([20])
      expect(w.get('[data-maximum-tick]').attributes('data-tick-value')).toBe('80')
      await w.setProps({
        axes: {
          y: {
            nice: false,
            lowerPaddingEnabled: false,
            lowerPaddingRatio: 0.1,
            maximumTickVisible: false,
            minimumTickVisible: false,
          },
        },
      })
      await flushVueChartUpdates()
      expect(minima(w)).toEqual([])
      expect(
        w
          .findAll('.waveform-track__axis--y .tick text')
          .every(
            (text) =>
              (text.attributes('display') === 'none') ===
              (Number(text.element.parentElement!.getAttribute('data-tick-y')) === 0),
          ),
      ).toBe(true)
      w.unmount()
    },
  )

  it('prioritizes the minimum over nearby labels, tick strokes and grid lines', async () => {
    const w = await mountSizedChart(data, {
      grid: { rowCount: 1 },
      axes: { y: { nice: false, lowerPaddingRatio: 0.001 } },
    })
    const ordinary = w
      .findAll('.waveform-track__axis--y .tick')
      .find((tick) => tick.attributes('data-tick-value') === '19.94')!
    expect(ordinary.get('text').attributes('display')).toBe('none')
    expect(ordinary.get('line').attributes('display')).toBe('none')
    expect(w.get('[data-minimum-tick] text').attributes('display')).toBeUndefined()
    const minimumY = Number(w.get('[data-minimum-tick]').attributes('data-tick-y'))
    const nearbyGrid = w
      .findAll('[data-grid-direction="horizontal"]')
      .filter((line) => Math.abs(Number(line.attributes('y1')) - minimumY) < 2)
    expect(nearbyGrid.length).toBeGreaterThan(0)
    expect(nearbyGrid.every((line) => line.attributes('display') === 'none')).toBe(true)
    expect(w.find('.waveform-chart__plot-frame').exists()).toBe(true)
    w.unmount()
  })

  it('deduplicates constant extrema and preserves the original value', async () => {
    for (const y of [0, 5, -5]) {
      const w = await mountSizedChart(
        { kind: 'points', points: [{ x: 0, y }] },
        {
          axes: { y: { lowerPaddingEnabled: true, upperPaddingEnabled: true } },
        },
      )
      expect(minima(w)).toEqual([y])
      expect(w.get('[data-minimum-tick]').attributes('data-maximum-tick')).toBe('true')
      expect(w.get('[data-minimum-tick] text').attributes('display')).toBeUndefined()
      w.unmount()
    }
  })

  it('uses visible error endpoints and refreshes data and resize without accumulation', async () => {
    const w = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
            errorBar: { visible: true },
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -100, lowerError: 20 },
                { x: 1, y: 0 },
              ],
            },
          },
        ],
      },
      { axes: { y: { nice: false, lowerPaddingEnabled: true } } },
    )
    expect(minima(w)).toEqual([-120])
    await w.setProps({ data })
    await flushVueChartUpdates()
    expect(minima(w)).toEqual([20])
    resizeChart(360, 300)
    await flushVueChartUpdates()
    expect(minima(w)).toEqual([20])
    expect(w.findAll('.waveform-track__axis--y .tick')[0].attributes('data-tick-value')).toBe('14')
    w.unmount()
  })

  it('retains cached extrema when a previously populated series becomes empty', async () => {
    const w = await mountSizedChart(data, {
      yDomain: [0, 100],
      axes: { y: { nice: false, lowerPaddingEnabled: true } },
    })
    expect(minima(w)).toEqual([20])
    await w.setProps({ yDomain: undefined, data: { kind: 'points', points: [] } })
    expect(minima(w)).toEqual([20])
    w.unmount()
  })

  it('preserves both extrema when their labels overlap', async () => {
    const w = await mountSizedChart(data, {
      axes: { y: { nice: false, lowerPaddingEnabled: true, upperPaddingEnabled: true } },
    })
    for (const selector of ['[data-minimum-tick] text', '[data-maximum-tick] text']) {
      Object.defineProperty(w.get(selector).element, 'getBoundingClientRect', {
        value: () => ({ left: 0, right: 30, top: 0, bottom: 11, width: 30, height: 11 }),
      })
    }
    updateMaximumTickVisibility(w.get('svg').element as SVGSVGElement)
    expect(w.get('[data-minimum-tick] text').attributes('display')).toBeUndefined()
    expect(w.get('[data-maximum-tick] text').attributes('display')).toBeUndefined()
    w.unmount()
  })
})

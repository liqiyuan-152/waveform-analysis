import { describe, expect, it } from 'vitest'

import { updateMaximumTickVisibility } from '@/components/rendering/yAxisTickVisibility'
import { resolveYAxisTickValues } from '@/components/core/yAxisTicks'
import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'
import type { WaveformData } from '@/types'

describe('configured amplitude boundary ticks', () => {
  it('restores exact bounds after data-maximum filtering without changing unbounded behavior', () => {
    expect(resolveYAxisTickValues([-50, 0, 50], 20, -10, { lower: -73, upper: 86 })).toEqual([
      -73, -50, -10, 0, 20, 86,
    ])
    expect(resolveYAxisTickValues([-50, 0, 50], 20, -10)).toEqual([-50, -10, 0, 20])
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'preserves configured endpoints on both axes in %s regardless of extrema switches or nice',
    async (displayMode) => {
      const data: WaveformData = {
        kind: 'series',
        series: Array.from({ length: 4 }, (_, index) => ({
          id: `s${index}`,
          name: `S${index}`,
          trackId: `t${Math.floor(index / 2)}`,
          data: { kind: 'samples', values: [-72.9, 85.9], sampleRate: 1 },
        })),
      }
      const wrapper = await mountSizedChart(data, {
        displayMode,
        overlayMode: 'multi-axis',
        grid: { rowCount: 2 },
        amplitudeLimits: Object.fromEntries(
          [0, 1, 2, 3].map((i) => [`s${i}`, { lower: -73, upper: 86 }]),
        ),
      })
      try {
        const verify = () => {
          const axes = wrapper.findAll('.waveform-track__axis--y')
          expect(axes).toHaveLength(4)
          expect(axes.map((axis) => axis.attributes('data-y-axis-side'))).toEqual([
            'left',
            'right',
            'left',
            'right',
          ])
          for (const axis of axes) {
            expect(axis.attributes('data-label-domain-min')).toBe('-73')
            expect(axis.attributes('data-label-domain-max')).toBe('86')
            for (const [side, value, y] of [
              [
                'lower',
                '-73',
                Number(axis.element.closest('.waveform-track')!.getAttribute('data-track-height')),
              ],
              ['upper', '86', 0],
            ] as const) {
              const tick = axis.get(`[data-boundary-tick="${side}"]`)
              expect(tick.attributes('data-tick-value')).toBe(value)
              expect(Number(tick.attributes('data-tick-y'))).toBe(y)
              expect(tick.get('text').text()).toBe(value)
              expect(tick.get('text').attributes('display')).toBeUndefined()
            }
          }
          if (displayMode === 'compact') {
            expect(
              Number(axes[0]!.get('[data-boundary-tick="lower"] text').attributes('y')),
            ).toBeLessThan(0)
            expect(
              Number(axes[2]!.get('[data-boundary-tick="upper"] text').attributes('y')),
            ).toBeGreaterThan(0)
          }
        }
        verify()
        for (const nice of [true, false]) {
          await wrapper.setProps({
            axes: {
              y: {
                nice,
                maximumTickVisible: false,
                minimumTickVisible: false,
                upperPaddingEnabled: true,
                lowerPaddingEnabled: true,
              },
            },
          })
          verify()
          const svg = wrapper.get('svg').element as SVGSVGElement
          const before = svg.innerHTML
          updateMaximumTickVisibility(svg)
          expect(svg.innerHTML).toBe(before)
        }
        await wrapper.setProps({ amplitudeLimits: {} })
        expect(wrapper.find('[data-boundary-tick]').exists()).toBe(false)
      } finally {
        wrapper.unmount()
      }
    },
  )

  it.each([{ lower: -73 }, { upper: 86 }])('retains the configured side for %o', async (limit) => {
    const wrapper = await mountSizedChart(gridSeries(1), {
      amplitudeLimits: { 'channel-0': limit },
      axes: { y: { maximumTickVisible: false, minimumTickVisible: false } },
    })
    try {
      const ticks = wrapper.findAll('[data-boundary-tick]')
      expect(ticks).toHaveLength(1)
      expect(ticks[0]!.get('text').text()).toBe(String(limit.lower ?? limit.upper))
      expect(ticks[0]!.get('text').attributes('display')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })

  it('displays the merged endpoints of a shared axis, rather than the data extrema', async () => {
    const data = gridSeries(2)
    if (data.kind === 'series')
      data.series.forEach((series) => {
        series.trackId = 'shared'
      })
    const wrapper = await mountSizedChart(data, {
      amplitudeLimits: {
        'channel-0': { lower: -73, upper: 86 },
        'channel-1': { lower: -100, upper: 200 },
      },
    })
    try {
      expect(wrapper.findAll('[data-boundary-tick] text').map((text) => text.text())).toEqual([
        '-100',
        '200',
      ])
      await wrapper.setProps({ hiddenSeriesIds: ['channel-1'] })
      expect(wrapper.findAll('[data-boundary-tick] text').map((text) => text.text())).toEqual([
        '-73',
        '86',
      ])
    } finally {
      wrapper.unmount()
    }
  })
})

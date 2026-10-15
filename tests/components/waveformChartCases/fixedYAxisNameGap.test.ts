import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { WaveformData } from '@/components/waveform'
import { resolveYAxisSpaceBudget } from '@/components/core/yAxisSpaceBudget'
import { Y_AXIS_TICK_PADDING } from '@/components/core/yAxisConstants'
import { mountSizedChart } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'

const configurations = (['independent', 'separated', 'compact'] as const).flatMap((displayMode) =>
  (['default', 'edge-compact'] as const).flatMap((layoutPreset) =>
    [false, true].map((multi) => ({ displayMode, layoutPreset, multi })),
  ),
)

describe('fixed channel name spacing', () => {
  it.each(configurations)(
    'keeps 2px beside fixed numeric regions in $displayMode / $layoutPreset / multi=$multi',
    async ({ displayMode, layoutPreset, multi }) => {
      const count = multi ? 16 : 2
      const units = Array.from({ length: count }, (_, index) =>
        index % 5 === 1 ? 'millivolts-per-phase' : 'V',
      )
      const data: WaveformData = {
        kind: 'series',
        series: units.map((unit, index) => ({
          id: `channel-${index}`,
          trackId: `frame-${multi ? Math.floor(index / 4) : index}`,
          name: `Channel ${index}`,
          unit,
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1.2345 * [1, 1e6, 1e-6, 1e100][index % 4]! },
              { x: 1, y: 1.2345 * [1, 1e6, 1e-6, 1e100][index % 4]! },
            ],
          },
        })),
      }
      const chart = await mountSizedChart(data, {
        displayMode,
        layoutPreset,
        overlayMode: multi ? 'multi-axis' : 'single-axis',
        grid: { rowCount: 2, columnCount: multi ? 2 : 1 },
      })
      try {
        resizeObservers.at(-1)?.resize(multi ? 1600 : 800, 600)
        await flushPromises()
        for (const fontSize of [12, 24, 48]) {
          for (const showUnits of [true, false]) {
            await chart.setProps({
              unitDisplayMode: showUnits ? 'axis' : 'channel-label',
              axes: { y: { labelTextStyle: { fontSize } } },
            })
            await flushPromises()
            const marginLeft = Number(chart.attributes('data-chart-left-margin'))
            const svgWidth = Number(chart.get('.waveform-chart__svg').attributes('width'))
            const tracks = chart.findAll('.waveform-chart__track')
            const marginRight =
              svgWidth -
              marginLeft -
              Math.max(
                ...tracks.map(
                  (track) =>
                    Number(track.attributes('data-track-left')) +
                    Number(track.attributes('data-track-width')),
                ),
              )
            const titlePositions = new Map<number, number>()
            for (const track of tracks) {
              const width = Number(track.attributes('data-track-width'))
              const axes = track.findAll('.waveform-track__axis--y')
              for (const axis of axes) {
                const index = Number(axis.attributes('data-y-axis-index'))
                const side = axis.attributes('data-y-axis-side')
                const direction = side === 'left' ? -1 : 1
                const axisX = Number(
                  axis.attributes('transform')!.match(/translate\(([-\d.e+]+)/)![1],
                )
                const band = track.get(
                  multi
                    ? `[data-y-axis-title-index="${index}"] .waveform-chart__y-axis-label-bg`
                    : '.waveform-chart__y-axis-label-bg',
                )
                const nameWidth = Number(band.attributes('width'))
                const center = Number(band.attributes('x')) + nameWidth / 2
                const distances = axes
                  .filter((candidate) => candidate.attributes('data-y-axis-side') === side)
                  .map((candidate) =>
                    Number(candidate.attributes('transform')!.match(/translate\(([-\d.e+]+)/)![1]),
                  )
                  .filter((x) => direction * (x - axisX) > 0)
                  .sort((a, b) => Math.abs(a - axisX) - Math.abs(b - axisX))
                const boundary =
                  distances[0] ?? (side === 'left' ? -marginLeft : width + marginRight)
                const numericWidth =
                  Y_AXIS_TICK_PADDING +
                  Math.max(
                    ...units
                      .filter((_, seriesIndex) => !multi || seriesIndex % 4 === index)
                      .map(
                        (unit) =>
                          resolveYAxisSpaceBudget({ unit: showUnits ? unit : undefined })
                            .titleTickWidth,
                      ),
                  )
                const outerGap = Math.abs(boundary - center) - nameWidth / 2
                const innerGap = Math.abs(center - axisX) - nameWidth / 2 - numericWidth
                expect(outerGap).toBeGreaterThanOrEqual(6)
                expect(innerGap).toBeCloseTo(2, 8)
                const localCenter = center - (side === 'right' ? width : 0)
                if (titlePositions.has(index)) expect(localCenter).toBe(titlePositions.get(index))
                else titlePositions.set(index, localCenter)
              }
            }
          }
        }
      } finally {
        chart.unmount()
      }
    },
  )
})

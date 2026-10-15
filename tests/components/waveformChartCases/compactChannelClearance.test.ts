import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { resizeObservers } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'
import { measureYAxisTextWidth } from '@/components/core/yAxisTextWidth'

describe('compact channel name clearance', () => {
  it('reserves the longest labels and aligns screenshot-style channel names after resizing', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [0.7384, 1.2083, 1.9829, 2.5888].map((maximum, index) => ({
          id: `channel-${index}`,
          name: `SX2_7_0${index + 1}`,
          unit: 'V',
          data: {
            kind: 'points' as const,
            points: [
              { x: 0, y: -0.0014 },
              { x: 4, y: maximum },
            ],
          },
        })),
      },
      {
        displayMode: 'compact',
        grid: { rowCount: 4, columnCount: 1 },
        axes: { y: { nice: false } },
      },
    )
    try {
      let initialPositions: number[] | undefined
      const check = async (width: number) => {
        resizeObservers.at(-1)?.resize(width, 900)
        await flushPromises()
        const tracks = wrapper.findAll('.waveform-chart__track')
        const positions = tracks.map((track) =>
          Number(
            track
              .get('.waveform-chart__y-axis-label')
              .attributes('transform')
              ?.match(/translate\(([^,]+)/)?.[1],
          ),
        )
        expect(new Set(positions).size).toBe(1)
        initialPositions ??= positions
        expect(positions).toEqual(initialPositions)
        for (const track of tracks) {
          const band = track.get('.waveform-chart__y-axis-label-bg')
          const bandRight = Number(band.attributes('x')) + Number(band.attributes('width'))
          for (const label of track.findAll('.waveform-chart__axis--y .tick text')) {
            if (label.attributes('display') === 'none') continue
            const left = Number(label.attributes('x')) - measureYAxisTextWidth(label.text())
            expect(left - bandRight).toBeGreaterThanOrEqual(2)
          }
        }
        expect(tracks[1].findAll('.waveform-chart__axis--y .tick text').at(-1)?.text()).toMatch(
          /^\(V\)/,
        )
        expect(
          getComputedStyle(tracks[0].get('.waveform-chart__y-axis-label').element).fontSize,
        ).toBe('12px')
      }
      await check(1200)
      await check(375)
    } finally {
      wrapper.unmount()
    }
  })
})

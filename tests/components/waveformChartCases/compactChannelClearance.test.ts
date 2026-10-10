import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { resizeObservers } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

describe('compact channel name clearance', () => {
  it('keeps screenshot-style channel names close and aligned after resizing', async () => {
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
        // Six-character numeric ticks need 42px; non-overlapping unit prefixes
        // must not add another 28px to every channel name's distance.
        expect(positions[0]).toBe(-59)
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

import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { mountSizedChart } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'

describe('WaveformChart multi-axis labels', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'aligns channel names within each column across different tick widths in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [1, 10000, 0.001, 1000000].map((maximum, index) => ({
            id: `channel-${index}`,
            name: `通道 ${index}`,
            data: {
              kind: 'points' as const,
              points: [
                { x: 0, y: -maximum },
                { x: 1, y: maximum },
              ],
            },
          })),
        },
        { displayMode, grid: { rowCount: 2, columnCount: 2 } },
      )
      try {
        const assertAlignment = () => {
          const positions = new Map<number, number[]>()
          for (const track of wrapper.findAll('.waveform-chart__track')) {
            const left = Number(track.attributes('data-track-left'))
            const title = track.find('.waveform-chart__y-axis-label')
            if (!title.exists()) continue
            const x = Number(title.attributes('transform')?.match(/translate\(([^,]+)/)?.[1])
            positions.set(left, [...(positions.get(left) ?? []), left + x])
          }
          expect(positions.size).toBeGreaterThan(0)
          for (const values of positions.values()) {
            expect(values).toHaveLength(2)
            expect(new Set(values).size).toBe(1)
          }
        }
        assertAlignment()
        resizeObservers.at(-1)?.resize(520, 480)
        await flushPromises()
        assertAlignment()
      } finally {
        wrapper.unmount()
      }
    },
  )

  it('aligns single-axis and multi-axis titles in the same left-axis slot', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'single',
            trackId: 'single-track',
            name: '单轴',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1e120 },
                { x: 1, y: 1e120 },
              ],
            },
          },
          {
            id: 'left',
            trackId: 'multi-track',
            name: '左轴',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            id: 'right',
            trackId: 'multi-track',
            name: '右轴',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1000 },
                { x: 1, y: 3000 },
              ],
            },
          },
        ],
      },
      { overlayMode: 'multi-axis', grid: { rowCount: 2, columnCount: 1 } },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const titleX = (transform: string | undefined) =>
      Number(transform?.match(/translate\(([^,]+)/)?.[1])

    const singleX = titleX(tracks[0]!.get('.waveform-chart__y-axis-label').attributes('transform'))
    const multiX = titleX(
      tracks[1]!.findAll('.waveform-track__multi-axis-title text')[0]!.attributes('transform'),
    )
    expect(singleX).toBeLessThan(-17)
    expect(multiX).toBe(singleX)
    const maximumTickWidth = Math.max(
      7,
      ...tracks.flatMap((track) => {
        const height = Number(track.attributes('data-track-height'))
        return track
          .findAll('.waveform-chart__axis--y')[0]!
          .findAll('.tick')
          .filter((tick) => {
            const y = Number(tick.attributes('transform')?.match(/translate\(0,\s*([^)]*)/)?.[1])
            return Math.abs(y - height / 2) <= 22
          })
          .map((tick) => tick.text().length * 7)
      }),
    )
    expect(singleX).toBe(-maximumTickWidth - 7 - 10)
    expect(singleX).toBeGreaterThan(Number(tracks[0]!.attributes('data-y-axis-label-x')))
    wrapper.unmount()
  })
})

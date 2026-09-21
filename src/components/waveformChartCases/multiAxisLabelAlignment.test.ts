import { describe, expect, it } from 'vitest'

import { mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart multi-axis labels', () => {
  it('aligns single-axis and multi-axis Y-axis titles in one column', async () => {
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

    expect(titleX(tracks[0]!.get('.waveform-chart__y-axis-label').attributes('transform'))).toBe(
      titleX(
        tracks[1]!.findAll('.waveform-track__multi-axis-title text')[0]!.attributes('transform'),
      ),
    )
  })
})

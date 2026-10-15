import { describe, expect, it } from 'vitest'
import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'

const names = Array.from(
  { length: 5 },
  (_, index) => `很长的通道名称_测量信号_${index + 1}_LONG_CHANNEL_NAME`,
)
const data = {
  kind: 'series' as const,
  series: names.map((name, index) => ({
    id: `channel-${index}`,
    name,
    data: {
      kind: 'points' as const,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
  })),
}

describe('channel names in dense vertical grids', () => {
  for (const layoutPreset of ['default', 'edge-compact'] as const) {
    const cases = (['independent', 'separated', 'compact'] as const).flatMap((displayMode) =>
      [800, 320].map((width) => ({ displayMode, width })),
    )
    it.each(cases)(
      `shows every long name in a 5 by 1 grid (${layoutPreset}, $displayMode, $width px)`,
      async ({ displayMode, width }) => {
        const wrapper = await mountSizedChart(data, {
          width,
          height: width === 800 ? 360 : 240,
          layoutPreset,
          displayMode,
          grid: { rowCount: 5, columnCount: 1 },
          unitDisplayMode: 'channel-label-or-legend',
        })
        try {
          wrapper.findAll('.waveform-chart__y-axis-label').forEach((label) => {
            expect(getComputedStyle(label.element).fontSize).toBe('12px')
          })
          expect(
            wrapper
              .findAll('.waveform-chart__track')
              .every((track) => Number(track.attributes('data-track-height')) < 80),
          ).toBe(true)
          expect(
            wrapper.findAll('.waveform-chart__y-axis-label').map((label) => label.text()),
          ).toEqual(names)
          await wrapper.setProps({ cleanView: true })
          expect(wrapper.find('.waveform-chart__y-axis-label').exists()).toBe(false)
        } finally {
          wrapper.unmount()
        }
      },
    )
  }
  it('retains every channel name while resizing a mounted five-track chart', async () => {
    const wrapper = await mountSizedChart(data, {
      grid: { rowCount: 5, columnCount: 1 },
      unitDisplayMode: 'channel-label-or-legend',
    })
    const labels = () =>
      wrapper.findAll('.waveform-chart__y-axis-label').map((label) => label.text())
    expect(labels()).toEqual(names)
    resizeObservers.at(-1)?.resize(320, 240)
    await flushVueChartUpdates()
    expect(labels()).toEqual(names)
  })
})

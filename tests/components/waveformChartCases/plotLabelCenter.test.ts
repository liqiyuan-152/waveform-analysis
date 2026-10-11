import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountSizedChart } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'

const data = {
  kind: 'points' as const,
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 123456 },
  ],
}

function assertPlotCenter(wrapper: Awaited<ReturnType<typeof mountSizedChart>>) {
  const left = Number(wrapper.attributes('data-chart-left-margin'))
  const tracks = wrapper.findAll('.waveform-chart__track')
  const plotRight = Math.max(
    ...tracks.map(
      (track) =>
        Number(track.attributes('data-track-left')) + Number(track.attributes('data-track-width')),
    ),
  )
  const expected = left + plotRight / 2
  const area = wrapper.get('.waveform-chart__title-area').element as HTMLElement
  expect(area.style.boxSizing).toBe('border-box')
  expect(area.style.justifyContent).toBe('center')
  expect(
    Number.parseFloat(area.style.marginLeft) + Number.parseFloat(area.style.width) / 2,
  ).toBeCloseTo(expected)
  const label = wrapper.get('.waveform-chart__x-label')
  expect(Number(label.attributes('x'))).toBeCloseTo(expected)
  expect(label.attributes('text-anchor')).toBe('middle')
  return expected
}

describe('plot-centered chart and time titles', () => {
  for (const layoutPreset of ['default', 'edge-compact'] as const) {
    it.each(['independent', 'separated', 'compact'] as const)(
      `centers on the plot with asymmetric axes and resize (${layoutPreset}, %s)`,
      async (displayMode) => {
        const wrapper = await mountSizedChart(data, {
          layoutPreset,
          displayMode,
          xLabel: 'time(ms)',
          title: { text: 'shot:13366' },
          grid: { rowCount: 1, columnCount: 1 },
        })
        try {
          expect(assertPlotCenter(wrapper)).not.toBeCloseTo(400)
          resizeObservers.at(-1)?.resize(320, 360)
          await flushPromises()
          expect(assertPlotCenter(wrapper)).not.toBeCloseTo(160)
          await wrapper.setProps({ title: { text: 'shot:13366', textStyle: { rotation: 30 } } })
          assertPlotCenter(wrapper)
          await wrapper.setProps({
            title: { text: 'Shot:13366', align: 'left', textStyle: { rotation: 30 } },
          })
          const area = wrapper.get('.waveform-chart__title-area').element as HTMLElement
          expect(Number.parseFloat(area.style.marginLeft)).toBeCloseTo(
            Number(wrapper.attributes('data-chart-left-margin')),
          )
          expect(area.style.paddingLeft).toBe('0px')
          expect(area.style.justifyContent).toBe('flex-start')
          expect(
            (wrapper.get('.waveform-chart__title-text').element as HTMLElement).style.textAlign,
          ).toBe('left')
          expect(wrapper.get('.waveform-chart__title-text').attributes('style')).toContain(
            'rotate(30deg)',
          )
          await wrapper.setProps({
            title: { text: 'Shot:13366', align: 'center' },
            data: {
              ...data,
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          })
          assertPlotCenter(wrapper)
        } finally {
          wrapper.unmount()
        }
      },
    )
  }

  it('tracks both-side multi-axis clearance and keeps explicit title alignment', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [0, 1, 2].map((index) => ({
          id: `series-${index}`,
          trackId: 'merged',
          name: `Channel ${index}`,
          unit: 'V',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 10 ** (index + 1) },
            ],
          },
        })),
      },
      {
        layoutPreset: 'edge-compact',
        overlayMode: 'multi-axis',
        title: { text: 'shot:13366' },
        grid: { rowCount: 1, columnCount: 1 },
      },
    )
    try {
      assertPlotCenter(wrapper)
      for (const align of ['left', 'right'] as const) {
        await wrapper.setProps({ title: { text: 'shot:13366', align } })
        const area = wrapper.get('.waveform-chart__title-area').element as HTMLElement
        if (align === 'left') {
          expect(Number.parseFloat(area.style.marginLeft)).toBeCloseTo(
            Number(wrapper.attributes('data-chart-left-margin')),
          )
          expect(area.style.paddingLeft).toBe('0px')
          expect(Number.parseFloat(area.style.width)).toBeGreaterThan(0)
        } else {
          expect(area.style.marginLeft).toBe('')
          expect(area.style.width).toBe('')
        }
        expect(area.style.justifyContent).toBe(align === 'left' ? 'flex-start' : 'flex-end')
      }
      await wrapper.setProps({ title: { text: 'shot:13366', align: 'center' } })
      assertPlotCenter(wrapper)
    } finally {
      wrapper.unmount()
    }
  })
})

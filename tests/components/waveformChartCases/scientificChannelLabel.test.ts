import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'

import { mountSizedChart } from '@tests/support/waveformChart'
import { measureYAxisTextWidth } from '@/components/core/yAxisTextWidth'

describe('scientific channel name placement', () => {
  it.each(['default', 'edge-compact'] as const)(
    'allows full exponents to overlap long names without changing layout (%s)',
    async (layoutPreset) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: ['left', 'right'].map((id) => ({
            id,
            trackId: 'frame',
            name: `${id}_LONG_CHANNEL_NAME`.repeat(5),
            data: { kind: 'samples', values: [-3.4567e-6, 3.4567e-6], sampleRate: 1 },
          })),
        },
        {
          overlayMode: 'multi-axis',
          layoutPreset,
          height: 200,
          yDomain: [-1e-5, 2e-5],
          grid: { rowCount: 1 },
          animationEnabled: false,
          axes: { y: { nice: false } },
        },
      )
      try {
        const track = wrapper.get('.waveform-chart__track')
        const initialMargin = wrapper.get('.waveform-chart').attributes('data-chart-left-margin')
        const initialWidth = track.attributes('data-track-width')
        const initialTitles = track
          .findAll('.waveform-chart__y-axis-label')
          .map((label) => label.attributes('transform'))
        for (const axis of track.findAll('.waveform-track__axis--y')) {
          const index = axis.attributes('data-y-axis-index')
          const band = track.get(
            `[data-y-axis-title-index="${index}"] .waveform-chart__y-axis-label-bg`,
          )
          const bandLeft = Number(band.attributes('x'))
          const bandRight = bandLeft + Number(band.attributes('width'))
          const label = axis.get('.tick[data-maximum-tick] text')
          expect(label.text()).toContain('E-05')
          expect(label.attributes('display')).toBeUndefined()
          const x =
            Number(axis.attributes('transform')?.match(/translate\(([^,]+)/)?.[1]) +
            Number(label.attributes('x'))
          const width = measureYAxisTextWidth(label.text())
          if (axis.attributes('data-y-axis-side') === 'left') {
            expect(x - width).toBeLessThan(bandRight)
            expect(x).toBeGreaterThan(bandLeft)
          } else {
            expect(x + width).toBeGreaterThan(bandLeft)
            expect(x).toBeLessThan(bandRight)
          }
        }
        await wrapper.setProps({ yDomain: [-2e-5, 1e-5] })
        await flushPromises()
        expect(wrapper.get('.waveform-chart').attributes('data-chart-left-margin')).toBe(
          initialMargin,
        )
        expect(track.attributes('data-track-width')).toBe(initialWidth)
        expect(
          track
            .findAll('.waveform-chart__y-axis-label')
            .map((label) => label.attributes('transform')),
        ).toEqual(initialTitles)
        expect(
          track
            .findAll('.tick[data-maximum-tick] text')
            .every(
              (label) => label.text().includes('E-05') && label.attributes('display') !== 'none',
            ),
        ).toBe(true)
      } finally {
        wrapper.unmount()
      }
    },
  )

  it.each([320, 800])('keeps the reserved scientific label space at width %s', async (width) => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'channel',
            name: 'CHANNEL_A',
            unit: 'V',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
        ],
      },
      {
        width,
        height: 500,
        layoutPreset: 'edge-compact',
        unitDisplayMode: 'legend-single-series',
        grid: { rowCount: 1, columnCount: 1 },
        yDomain: [0, 3],
        axes: { y: { nice: false, maximumTickVisible: false, minimumTickVisible: false } },
      },
    )
    try {
      const labelX = () => Number(wrapper.get('.waveform-chart__y-axis-label-bg').attributes('x'))
      const decimalX = labelX()
      const decimalMargin = wrapper.get('.waveform-chart').attributes('data-chart-left-margin')
      await wrapper.setProps({ yDomain: [0, 30000] })
      await flushPromises()
      expect(wrapper.get('.waveform-chart__axis--y').text()).toContain('E+04')
      // Both formats fit the same reserved band, including the full exponent.
      expect(labelX()).toBe(decimalX)
      expect(Number(wrapper.get('.waveform-chart').attributes('data-chart-left-margin'))).toBe(
        Number(decimalMargin),
      )
      expect(
        Number(wrapper.get('.waveform-chart').attributes('data-chart-left-margin')) + labelX(),
      ).toBeGreaterThanOrEqual(2)
      await wrapper.setProps({ yDomain: [0, 0.0003] })
      await flushPromises()
      expect(wrapper.get('.waveform-chart__axis--y').text()).toContain('E-04')
      expect(labelX()).toBe(decimalX)
      expect(Number(wrapper.get('.waveform-chart').attributes('data-chart-left-margin'))).toBe(
        Number(decimalMargin),
      )
    } finally {
      wrapper.unmount()
    }
  })
})

describe('dense scientific axes', () => {
  it('reserves scientific labels while keeping six short frame names at the same distance', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 6 }, (_, index) => ({
          id: `channel-${index}`,
          name: `MP02BP0${index + 1}`,
          unit: 'V',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        })),
      },
      {
        width: 800,
        height: 650,
        grid: { rowCount: 6, columnCount: 1 },
        layoutPreset: 'edge-compact',
        unitDisplayMode: 'channel-label-or-legend',
        yDomain: [0, 3.824],
        axes: { y: { nice: false, maximumTickVisible: false, minimumTickVisible: false } },
      },
    )
    try {
      const positions = () =>
        wrapper
          .findAll('.waveform-chart__y-axis-label')
          .map((label) => label.attributes('transform'))
      const plainPositions = positions()
      const plainMargin = wrapper.get('.waveform-chart').attributes('data-chart-left-margin')
      expect(plainPositions).toHaveLength(6)
      for (const [max, exponent] of [
        [0.0003824, 'E-04'],
        [38240, 'E+04'],
      ] as const) {
        await wrapper.setProps({ yDomain: [0, max] })
        await flushPromises()
        expect(positions()).toEqual(plainPositions)
        expect(Number(wrapper.get('.waveform-chart').attributes('data-chart-left-margin'))).toBe(
          Number(plainMargin),
        )
        expect(
          wrapper
            .findAll('.waveform-chart__axis--y .tick text')
            .filter((label) => label.attributes('display') !== 'none')
            .filter((label) => label.text().startsWith('E'))
            .map((label) => label.text().split(' ')[0]),
        ).toEqual(Array(6).fill(exponent))
        wrapper.findAll('.waveform-chart__axis--y').forEach((axis) => {
          expect(axis.findAll('.tick text').at(-1)?.text()).toBe(`${exponent} 3.824`)
        })
        expect(wrapper.findAll('.waveform-track__axis-exponent')).toHaveLength(0)
        expect(
          wrapper
            .findAll('.waveform-chart__y-axis-label')
            .every((label) => label.text().includes('(V)')),
        ).toBe(true)
      }
      await wrapper.setProps({ yDomain: [0, 3.824] })
      await flushPromises()
      expect(
        wrapper
          .findAll('.waveform-chart__axis--y .tick text')
          .filter((label) => label.text().startsWith('E')),
      ).toHaveLength(0)
      expect(positions()).toEqual(plainPositions)
    } finally {
      wrapper.unmount()
    }
  })
})

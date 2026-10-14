import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { mountSizedChart } from '@tests/support/waveformChart'

describe('scientific channel name placement', () => {
  it.each([320, 800])('ignores scientific multipliers at width %s', async (width) => {
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
      const decimalMargin = wrapper.attributes('data-chart-left-margin')
      await wrapper.setProps({ yDomain: [0, 30000] })
      await flushPromises()
      expect(wrapper.get('.waveform-chart__axis--y').text()).toContain('E+04')
      // Both ranges show 0, 0.75, 1.5, 2.25, 3. The top scientific
      // multiplier is excluded from name spacing, but included in outer clearance.
      expect(labelX()).toBe(decimalX)
      expect(Number(wrapper.attributes('data-chart-left-margin'))).toBeGreaterThanOrEqual(
        Number(decimalMargin),
      )
      expect(
        Number(wrapper.attributes('data-chart-left-margin')) + labelX(),
      ).toBeGreaterThanOrEqual(6)
      await wrapper.setProps({ yDomain: [0, 0.0003] })
      await flushPromises()
      expect(wrapper.get('.waveform-chart__axis--y').text()).toContain('E-04')
      expect(labelX()).toBe(decimalX)
      expect(Number(wrapper.attributes('data-chart-left-margin'))).toBeGreaterThanOrEqual(
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
      const plainMargin = wrapper.attributes('data-chart-left-margin')
      expect(plainPositions).toHaveLength(6)
      for (const [max, exponent] of [
        [0.0003824, 'E-04'],
        [38240, 'E+04'],
      ] as const) {
        await wrapper.setProps({ yDomain: [0, max] })
        await flushPromises()
        expect(positions()).toEqual(plainPositions)
        expect(Number(wrapper.attributes('data-chart-left-margin'))).toBeGreaterThan(
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

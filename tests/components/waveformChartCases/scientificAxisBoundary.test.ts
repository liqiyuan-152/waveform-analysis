import { describe, expect, it } from 'vitest'
import { mountSizedChart } from '@tests/support/waveformChart'

describe('scientific Y-axis inclusive boundaries', () => {
  it.each([
    { domain: [0, 0.001], exponent: 'E-03' },
    { domain: [-0.001, 0], exponent: 'E-03' },
    { domain: [0, 1000], exponent: 'E+03' },
    { domain: [-1000, 0], exponent: 'E+03' },
    { domain: [0, 0.001001], exponent: null },
    { domain: [0, 999.999], exponent: null },
  ])('formats the visible fixed axis $domain', async ({ domain, exponent }) => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: domain[0]! },
          { x: 1, y: domain[1]! },
        ],
      },
      {
        yDomain: domain as [number, number],
        axes: { y: { nice: false } },
        layoutPreset: 'edge-compact',
        grid: { rowCount: 1, columnCount: 1 },
      },
    )
    try {
      const axis = wrapper.get('.waveform-chart__axis--y').text()
      if (exponent) expect(axis).toContain(exponent)
      else expect(axis).not.toMatch(/E[+-]\d+/)
    } finally {
      wrapper.unmount()
    }
  })
})

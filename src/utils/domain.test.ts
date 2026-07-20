import { describe, expect, it } from 'vitest'

import { buildMinorTicks } from './domain'

describe('buildMinorTicks', () => {
  it('preserves the existing behavior when no domain is provided', () => {
    expect(buildMinorTicks([0, 10, 20], 5)).toEqual([2, 4, 6, 8, 12, 14, 16, 18])
  })

  it('fills the partial interval after the final major tick', () => {
    const majorTicks = Array.from({ length: 13 }, (_, index) => -8000 + index * 1000)

    expect(buildMinorTicks(majorTicks, 5, [-8000, 4990.3]).slice(-4)).toEqual([
      4200, 4400, 4600, 4800,
    ])
  })

  it('fills both edge intervals and excludes the domain endpoints', () => {
    const ticks = buildMinorTicks([-7000, -6000, -5000], 5, [-7950, -4100])

    expect(ticks).toEqual([
      -7800, -7600, -7400, -7200, -6800, -6600, -6400, -6200, -5800, -5600, -5400,
      -5200, -4800, -4600, -4400, -4200,
    ])
    expect(ticks).not.toContain(-7950)
    expect(ticks).not.toContain(-4100)
  })
})

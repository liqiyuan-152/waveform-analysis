import { describe, expect, it } from 'vitest'
import { yAxisTickValues } from '../../../src/display/renderer/helpers'

describe('Y-axis tick values', () => {
  it('builds equal intervals including both exact endpoints', () => {
    expect(yAxisTickValues([1.1, 9.9], 5)).toEqual([
      1.1, 3.3000000000000003, 5.5, 7.700000000000001, 9.9,
    ])
  })

  it('uses at least two ticks and falls back for invalid counts', () => {
    expect(yAxisTickValues([2, 8], 1)).toEqual([2, 8])
    expect(yAxisTickValues([2, 8], Number.NaN)).toHaveLength(6)
  })
})

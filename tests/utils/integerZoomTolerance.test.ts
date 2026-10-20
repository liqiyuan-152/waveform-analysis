import { describe, expect, it } from 'vitest'
import {
  alignIntegerZoomDomain,
  normalizeIntegerZoomDomain,
  integerZoomTicks,
} from '@/components/interaction/integerZoom'

describe('integer zoom conversion tolerance', () => {
  it.each([1, -1])('normalizes millisecond roundoff for sign %s without widening', (sign) => {
    const source: [number, number] =
      sign > 0
        ? [0.025 - Number.EPSILON, 0.075 + Number.EPSILON]
        : [-0.075 - Number.EPSILON, -0.025 + Number.EPSILON]
    const expected = sign > 0 ? [0.025, 0.075] : [-0.075, -0.025]
    const options = { integerZoom: true, timeUnit: 'ms' as const }
    expect(alignIntegerZoomDomain(source, options)).toEqual(expected)
    expect(normalizeIntegerZoomDomain(source, options)).toEqual(expected)
    expect(
      integerZoomTicks(source, 5, options).every((value) => Number.isInteger(value * 1000)),
    ).toBe(true)
  })
  it('retains real fractions and sub-unit spans', () => {
    const options = { integerZoom: true, timeUnit: 'ms' as const }
    expect(alignIntegerZoomDomain([0.024999, 0.075001], options)).toEqual([0.024, 0.076])
    expect(normalizeIntegerZoomDomain([0.0251, 0.0259], options)).toEqual([0.0251, 0.0259])
    expect(alignIntegerZoomDomain([0.0251, 0.0259], options)).toEqual([0.0251, 0.0259])
    expect(alignIntegerZoomDomain([0.025, 0.075], { integerZoom: true, timeUnit: 's' })).toEqual([
      0.025, 0.075,
    ])
  })
})

import { describe, expect, it } from 'vitest'

import { resolveXAxisTicks } from '@/components/core/xAxisTicks'
import { integerZoomTicks } from '@/components/interaction/integerZoom'

describe('X-axis numeric ticks', () => {
  it('keeps fine screenshot ticks distinct and honors fractional minimum intervals', () => {
    const domain = Object.freeze([1.175356, 1.175358] as const)
    const ticks = resolveXAxisTicks(domain, 5)
    expect(ticks.length).toBeGreaterThan(2)
    expect(new Set(ticks).size).toBe(ticks.length)
    expect(ticks.every((tick) => tick >= domain[0] && tick <= domain[1])).toBe(true)
    expect(resolveXAxisTicks([0, 0.5], 10, 0.125)).toEqual([0, 0.125, 0.25, 0.375, 0.5])
  })
  it('uses ECharts three-based intervals without extending or mutating the domain', () => {
    const domain = Object.freeze([0, 14] as const)
    expect(resolveXAxisTicks(domain, 5)).toEqual([0, 3, 6, 9, 12])
    expect(domain).toEqual([0, 14])
    expect(resolveXAxisTicks([-0.007, 0.008], 5)).toEqual([-0.006, -0.003, 0, 0.003, 0.006])
  })

  it('keeps fractional boundaries separate from equally spaced major ticks', () => {
    expect(resolveXAxisTicks([0.13, 1.37], 5)).toEqual([0.2, 0.4, 0.6, 0.8, 1, 1.2])
    expect(resolveXAxisTicks([0.1, 0.3], 2)).toEqual([0.1, 0.2, 0.3])
    expect(resolveXAxisTicks([14, 0], 5)).toEqual([12, 9, 6, 3, 0])
  })

  it('changes density with the requested split count', () => {
    expect(resolveXAxisTicks([0, 14], 2)).toEqual([0, 10])
    expect(resolveXAxisTicks([0, 14], 14)).toHaveLength(15)
  })

  it('keeps ordinary raw ticks independent of the display unit', () => {
    const domain: [number, number] = [0, 0.014]
    expect(integerZoomTicks(domain, 5, { timeUnit: 's' })).toEqual([0, 0.003, 0.006, 0.009, 0.012])
    expect(integerZoomTicks(domain, 5, { timeUnit: 'ms' })).toEqual(
      integerZoomTicks(domain, 5, { timeUnit: 's' }),
    )
  })

  it('allows fractional ticks when integer-mode panning crosses an integer', () => {
    expect(integerZoomTicks([1.9, 2.1], 4, { integerZoom: true, timeUnit: 's' })).toEqual([
      1.9, 1.95, 2, 2.05, 2.1,
    ])
    expect(integerZoomTicks([1, 2], 8, { integerZoom: true, timeUnit: 's' })).toEqual([1, 2])
    expect(integerZoomTicks([0.001, 0.003], 8, { integerZoom: true })).toEqual([
      0.001, 0.002, 0.003,
    ])
  })

  it('handles invalid, constant and extreme ranges without duplicate ticks', () => {
    expect(resolveXAxisTicks([NaN, 1], 5)).toEqual([])
    expect(resolveXAxisTicks([0, Infinity], 5)).toEqual([])
    expect(resolveXAxisTicks([2, 2], 5)).toEqual([2])
    expect(resolveXAxisTicks([0, 14], NaN)).toEqual([0, 3, 6, 9, 12])
    for (const domain of [
      [0, 1e-120],
      [1e15, 1e15 + 1],
      [0, 1],
    ] as [number, number][]) {
      const ticks = resolveXAxisTicks(domain, domain[1] === 1 ? 1e6 : 5)
      expect(ticks.length).toBeLessThanOrEqual(3000)
      expect(new Set(ticks).size).toBe(ticks.length)
      expect(
        ticks.every((value) => Number.isFinite(value) && value >= domain[0] && value <= domain[1]),
      ).toBe(true)
      expect(ticks.every((value, index) => index === 0 || value > ticks[index - 1]!)).toBe(true)
    }
  })

  it('returns no invalid ticks when finite endpoints have an overflowing span', () => {
    const domain = Object.freeze([-Number.MAX_VALUE, Number.MAX_VALUE] as const)
    expect(resolveXAxisTicks(domain, 5)).toEqual([])
    expect(resolveXAxisTicks([domain[1], domain[0]], 5)).toEqual([])
    expect(domain).toEqual([-Number.MAX_VALUE, Number.MAX_VALUE])
  })

  it.each([1.5, 1.8, 2])('regenerates oversize fallback ticks across [0, %s]', (end) => {
    const domain = Object.freeze([0, end] as const)
    const ticks = resolveXAxisTicks(domain, 1e6)
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.length).toBeLessThanOrEqual(3000)
    expect(ticks[0]).toBe(0)
    expect(ticks.at(-1)).toBe(end)
    const interval = ticks[1]! - ticks[0]!
    ticks.forEach((value, index) => {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(end)
      expect(value).toBeCloseTo(index * interval, 12)
      if (index > 0) expect(value).toBeGreaterThan(ticks[index - 1]!)
    })
    expect(resolveXAxisTicks([end, 0], 1e6)).toEqual([...ticks].reverse())
    expect(domain).toEqual([0, end])
  })

  it('normalizes negative zero in constant, regular and fallback ranges', () => {
    expect(Object.is(resolveXAxisTicks([-0, -0], 5)[0], -0)).toBe(false)
    for (const ticks of [resolveXAxisTicks([-1, 1], 5), resolveXAxisTicks([-2, 2], 1e6)]) {
      expect(ticks).toContain(0)
      expect(ticks.every((value) => !Object.is(value, -0))).toBe(true)
      expect(new Set(ticks).size).toBe(ticks.length)
    }
  })

  it('returns an empty set when subnormal spacing cannot produce valid ticks', () => {
    expect(resolveXAxisTicks([0, 1e-320], 5)).toEqual([])
  })
})

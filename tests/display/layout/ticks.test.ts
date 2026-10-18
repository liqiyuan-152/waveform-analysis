import { describe, expect, it } from 'vitest'
import { NiceXTickStrategy } from '../../../src/display/layout/ticks/NiceXTickStrategy'
import { NiceYTickStrategy } from '../../../src/display/layout/ticks/NiceYTickStrategy'

describe('nice tick strategies', () => {
  it('uses X three-step intervals without expanding the domain', () => {
    const domain: [number, number] = [0, 14]
    const ticks = new NiceXTickStrategy().within(domain, 5)
    expect(ticks.domain).toEqual([0, 14])
    expect(ticks.majorValues).toEqual([0, 3, 6, 9, 12])
    expect(domain).toEqual([0, 14])
    expect(new NiceXTickStrategy(4).within(domain, 5).majorValues).toEqual([0, 4, 8, 12])
    expect(new NiceXTickStrategy().within([14, 0], 5).majorValues).toEqual([12, 9, 6, 3, 0])
  })

  it('expands only unfixed Y boundaries and preserves the original interval', () => {
    const strategy = new NiceYTickStrategy()
    expect(strategy.target([1.3, 8.7], 5)).toMatchObject({
      domain: [0, 10],
      majorValues: [0, 2, 4, 6, 8, 10],
      interval: 2,
    })
    expect(strategy.target([1.3, 8.7], 5, true, true)).toMatchObject({
      domain: [1.3, 8.7],
      majorValues: [2, 4, 6, 8],
    })
    expect(strategy.target([1.3, 8.7], 5, true)).toMatchObject({ domain: [1.3, 10] })
    expect(strategy.target([8.7, 1.3], 5, true)).toMatchObject({ domain: [8.7, 0], interval: 2 })
    expect(strategy.within([1.3, 8.7], 5).domain).toEqual([1.3, 8.7])
  })

  it.each([
    [0, 1e-300],
    [1e15, 1e15 + 1],
    [-1e308, 1e308],
    [-0.01, 0.01],
    [0, 100],
  ])('bounds allocation and handles extreme domain %s to %s', (start, end) => {
    for (const strategy of [new NiceXTickStrategy(), new NiceYTickStrategy()]) {
      const result = strategy.within([start, end], 1e12)
      expect(result.majorValues.length).toBeLessThanOrEqual(100)
      expect(new Set(result.majorValues).size).toBe(result.majorValues.length)
      expect(
        result.majorValues.every((value) => Number.isFinite(value) && !Object.is(value, -0)),
      ).toBe(true)
      if (result.interval !== undefined) expect(result.interval).toBeGreaterThan(0)
      if (result.majorValues.length > 2)
        expect(
          result.majorValues[result.majorValues.length - 1] - result.majorValues[0],
        ).toBeGreaterThan((end - start) / 2)
    }
  })
})

it('returns finite boundaries only when expansion overflows or indices cannot be distinguished', () => {
  const domain: [number, number] = [1.1e308, 1.79e308]
  const result = new NiceYTickStrategy().target(domain, 2)
  expect(result.domain).toEqual(domain)
  expect(result.majorValues).toEqual([])
  expect(result.interval).toBeUndefined()
  expect(result.boundaryValues).toEqual(domain)
  const precision = new NiceXTickStrategy().within([1e16, 1e16 + 2], 100)
  expect(precision.majorValues).toEqual([])
  expect(precision.interval).toBeUndefined()
})

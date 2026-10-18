import * as d3 from 'd3'
import { describe, expect, it } from 'vitest'
import type { XAxisOptions } from '../../../src/display/types/options'
import { resolveXAxisTickValues } from '../../../src/display/renderer/xTicks'

function ticks(domain: [number, number], axis: XAxisOptions, innerWidth = 800): number[] {
  const scale = d3.scaleLinear().domain(domain).range([0, innerWidth])
  return resolveXAxisTickValues(scale, axis, innerWidth)
}

describe('resolveXAxisTickValues', () => {
  it('aligns a valid custom step to zero', () => {
    expect(ticks([3, 23], { tickStep: 5 })).toEqual([5, 10, 15, 20])
  })

  it('generates decimal steps without accumulated floating-point noise', () => {
    expect(ticks([0, 0.5], { tickStep: 0.1 })).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5])
  })

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to tickCount for an invalid step of %s',
    (tickStep) => {
      const scale = d3.scaleLinear().domain([0, 10]).range([0, 800])
      expect(resolveXAxisTickValues(scale, { tickStep, tickCount: 2 }, 800)).toEqual(scale.ticks(2))
    },
  )

  it('coarsens a small step more aggressively in a narrow plot', () => {
    const narrow = ticks([0, 1000], { tickStep: 1 }, 240)
    const wide = ticks([0, 1000], { tickStep: 1 }, 4800)

    expect(narrow.length).toBeLessThan(wide.length)
    expect(narrow.every((value) => Number.isInteger(value))).toBe(true)
    expect(wide.every((value) => Number.isInteger(value))).toBe(true)
  })

  it('uses formatted label width to refine the visible tick capacity', () => {
    const short = ticks([0, 1000], { tickStep: 10 }, 800)
    const long = ticks(
      [0, 1000],
      {
        tickStep: 10,
        tickFormat: (value) => `measurement:${value.toFixed(4)}`,
      },
      800,
    )

    expect(long.length).toBeLessThan(short.length)
  })

  it('never generates more than the hard visible tick limit', () => {
    expect(ticks([0, 100000], { tickStep: 1 }, 100000).length).toBeLessThanOrEqual(100)
  })

  it('returns no regular ticks when the step exceeds the domain span', () => {
    expect(ticks([3, 23], { tickStep: 100 })).toEqual([])
  })
})

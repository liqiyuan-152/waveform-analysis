import { describe, expect, it, vi } from 'vitest'
import * as d3 from 'd3'
import { getEasingFunction } from '@/index'
import type { EasingType } from '@/index'

const families = [
  ['quad', 'Quad'],
  ['cubic', 'Cubic'],
  ['quart', 'Poly'],
  ['quint', 'Poly'],
  ['sine', 'Sin'],
  ['expo', 'Exp'],
  ['circ', 'Circle'],
  ['back', 'Back'],
  ['elastic', 'Elastic'],
  ['bounce', 'Bounce'],
] as const
const cases: [EasingType, (p: number) => number][] = [['linear', d3.easeLinear]]
for (const [name, d3Name] of families) {
  for (const suffix of ['In', 'Out', 'InOut'] as const) {
    const fn = d3[`ease${d3Name}${suffix}`]
    cases.push([
      `${name}${suffix}`,
      name === 'quart' || name === 'quint'
        ? (fn as typeof d3.easePolyIn).exponent(name === 'quart' ? 4 : 5)
        : fn,
    ])
  }
}

describe('D3 easing public resolver', () => {
  it('covers exactly 31 unique names', () => {
    expect(new Set(cases.map(([name]) => name)).size).toBe(31)
  })
  it.each(cases)('%s preserves D3 samples and endpoints', (name, expected) => {
    const easing = getEasingFunction(name)
    for (const p of [0, 0.1, 0.25, 0.5, 0.6, 0.9, 1]) {
      expect(easing(p)).toBeCloseTo(expected(p), 14)
    }
    expect(easing(0)).toBeCloseTo(0, 14)
    expect(easing(1)).toBeCloseTo(1, 14)
  })
  it('matches independently known polynomial values', () => {
    expect(getEasingFunction('linear')(0.25)).toBe(0.25)
    expect(getEasingFunction('quadIn')(0.5)).toBe(0.25)
    expect(getEasingFunction('cubicOut')(0.5)).toBe(0.875)
    expect(getEasingFunction('quartIn')(0.5)).toBe(0.0625)
    expect(getEasingFunction('quintIn')(0.5)).toBe(0.03125)
    expect(getEasingFunction('quartInOut')(0.25)).toBe(0.03125)
    expect(getEasingFunction('quintOut')(0.5)).toBe(0.96875)
  })
  it('keeps back and elastic overshoot', () => {
    expect(getEasingFunction('backOut')(0.6)).toBeCloseTo(1.09935168, 8)
    expect(getEasingFunction('backIn')(0.4)).toBeLessThan(0)
    expect(getEasingFunction('elasticOut')(0.1)).toBeGreaterThan(1)
  })
  it('returns custom functions without executing or wrapping them', () => {
    const custom = vi.fn(() => NaN)
    expect(getEasingFunction(custom)).toBe(custom)
    expect(custom).not.toHaveBeenCalled()
    expect(getEasingFunction(custom)(0.5)).toBeNaN()
  })
  it.each(['unknown', 'easeLinear', 'toString', '__proto__', null, 3])(
    'rejects unsupported runtime input %s',
    (value) => {
      expect(() => getEasingFunction(value as EasingType)).toThrow(TypeError)
    },
  )
})

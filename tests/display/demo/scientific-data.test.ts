import { describe, expect, it } from 'vitest'
import { scientificSeries } from '../../../demo-app/src/display/scientific-data'
import {
  formatScientificAxisHeader,
  formatScientificAxisTick,
} from '../../../src/display/renderer/formatters'

describe('scientific demo data', () => {
  it('shows a shared E-04 exponent on its Y axis', () => {
    const values = scientificSeries[0].data.map((point) => point.y)
    const domain: [number, number] = [Math.min(...values), Math.max(...values)]
    expect(domain).toEqual([0.0002, 0.0008])
    expect(formatScientificAxisHeader(domain, scientificSeries[0].unit)).toBe('ms\u00a0\u00a0E-04')
    expect(formatScientificAxisTick(domain[0], domain)).toBe('2')
    expect(formatScientificAxisTick(domain[1], domain)).toBe('8')
  })
})

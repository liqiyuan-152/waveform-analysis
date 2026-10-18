import { resolveDataDomain } from '../../../src/display/layout/domain/DataDomainStrategy'
import { describe, expect, it } from 'vitest'
import { applyXDomainStrategy } from '../../../src/display/layout/domain/domain'

describe('X-domain strategy', () => {
  it('preserves the exact data domain by default', () => {
    expect(applyXDomainStrategy([0, 4.999999], { type: 'data' })).toEqual([0, 4.999999])
  })

  it('expands both bounds or only the end to readable values', () => {
    expect(applyXDomainStrategy([0.123, 4.999999], { type: 'nice', tickCount: 10 })).toEqual([0, 5])
    expect(
      applyXDomainStrategy([0.123, 4.999999], { type: 'nice', bounds: 'end', tickCount: 10 }),
    ).toEqual([0.123, 5])
  })

  it('preserves explicit domains unless includeExplicit is enabled', () => {
    const domain: [number, number] = [0.123, 4.999999]
    expect(applyXDomainStrategy(domain, { type: 'nice' }, true)).toEqual(domain)
    expect(applyXDomainStrategy(domain, { type: 'nice', includeExplicit: true }, true)).toEqual([
      0, 5,
    ])
  })

  it('falls back to a stable tick count for invalid values', () => {
    expect(applyXDomainStrategy([0.123, 4.999999], { type: 'nice', tickCount: 0 })).toEqual([0, 5])
  })
})

describe('data domain boundaries', () => {
  it('keeps explicit and reversed bounds and expands empty or constant domains', () => {
    expect(resolveDataDomain([])).toEqual([0, 1])
    expect(resolveDataDomain([], 3)).toEqual([3, 4])
    expect(resolveDataDomain([], undefined, 5)).toEqual([4, 5])
    expect(resolveDataDomain([2, 2])).toEqual([1, 3])
    expect(resolveDataDomain([], 2, 2)).toEqual([1, 3])
    expect(resolveDataDomain([1, 2], 10, -10)).toEqual([10, -10])
  })
})

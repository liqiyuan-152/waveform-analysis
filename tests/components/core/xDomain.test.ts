import { describe, expect, it } from 'vitest'

import { applyXDomainStrategy } from '@/components/core/xDomain'

describe('applyXDomainStrategy', () => {
  it('keeps the exact data domain by default', () => {
    expect(applyXDomainStrategy([0, 4999.999], { type: 'data' })).toEqual([0, 4999.999])
  })

  it('rounds outward to nearby multiples of ten without coarse nice ticks', () => {
    expect(applyXDomainStrategy([-62.88152, 14.999999], { type: 'integer-ms' })).toEqual([-63, 15])
    expect(applyXDomainStrategy([-8, 4.9903], { type: 'integer-ms' })).toEqual([-8, 5])
    expect(applyXDomainStrategy([0.0001, 0.0002], { type: 'integer-ms' })).toEqual([0.0001, 0.0002])
  })

  it('preserves explicit viewports unless integer rounding is requested', () => {
    const domain: [number, number] = [-62.88152, 14.999999]
    expect(applyXDomainStrategy(domain, { type: 'integer-ms' }, true)).toEqual(domain)
    expect(
      applyXDomainStrategy(domain, { type: 'integer-ms', includeExplicit: true }, true),
    ).toEqual([-63, 15])
  })

  it('expands both bounds to stable nice values', () => {
    expect(applyXDomainStrategy([123, 456], { type: 'nice' })).toEqual([100, 500])
  })

  it('can expand only the end bound', () => {
    expect(applyXDomainStrategy([123, 456], { type: 'nice', bounds: 'end' })).toEqual([123, 500])
  })

  it('keeps explicit domains exact unless they are included', () => {
    expect(applyXDomainStrategy([123, 456], { type: 'nice' }, true)).toEqual([123, 456])
    expect(applyXDomainStrategy([123, 456], { type: 'nice', includeExplicit: true }, true)).toEqual(
      [100, 500],
    )
  })

  it('falls back to the default tick count for invalid values', () => {
    expect(applyXDomainStrategy([0, 4999.999], { type: 'nice', tickCount: 0 })).toEqual([0, 5000])
  })
})

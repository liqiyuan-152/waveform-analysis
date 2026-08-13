import { describe, expect, it } from 'vitest'

import { applyXDomainStrategy } from './xDomain'

describe('applyXDomainStrategy', () => {
  it('keeps the exact data domain by default', () => {
    expect(applyXDomainStrategy([0, 4999.999], { type: 'data' })).toEqual([0, 4999.999])
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

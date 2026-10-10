import { describe, expect, it } from 'vitest'

import { resolveCompactPaginationBand } from '@/components/core/pagination'

describe('compact pagination band', () => {
  it('reserves nothing when pagination is hidden', () => {
    expect(resolveCompactPaginationBand(false)).toBe(0)
  })

  it('always reserves the compact height when pagination is visible', () => {
    expect(resolveCompactPaginationBand(true)).toBe(16)
  })
})

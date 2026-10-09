import { describe, expect, it } from 'vitest'

import { resolveCompactPaginationBand } from '@/components/core/pagination'

describe('compact pagination band', () => {
  it.each([320, 520, 800])('reserves nothing when hidden at width %s', (width) => {
    expect(resolveCompactPaginationBand(false, width, 7, width / 2, 'Time(ms)')).toBe(0)
  })

  it.each([320, 520])('keeps narrow pagination below Time at width %s', (width) => {
    expect(resolveCompactPaginationBand(true, width, 2, width / 2, 'Time(ms)')).toBe(40)
  })

  it('uses the compact band only when the full pagination fits beside Time', () => {
    expect(resolveCompactPaginationBand(true, 640, 2, 332, 'Time(ms)')).toBe(16)
    expect(resolveCompactPaginationBand(true, 640, 7, 332, 'Time(ms)')).toBe(40)
    expect(resolveCompactPaginationBand(true, 800, 2, 412, 'Time(ms)')).toBe(16)
    expect(
      resolveCompactPaginationBand(true, 640, 2, 332, '很长的时间坐标轴标签占位测试（毫秒）'),
    ).toBe(40)
    expect(resolveCompactPaginationBand(true, 521, 2, 272.5, 'Time(ms)')).toBe(40)
  })

  it('accounts for both ellipses on large page sets without counting every page', () => {
    expect(resolveCompactPaginationBand(true, 1000, 100, 500, 'Time(ms)')).toBe(40)
    expect(resolveCompactPaginationBand(true, 1200, 100, 600, 'Time(ms)')).toBe(16)
  })
})

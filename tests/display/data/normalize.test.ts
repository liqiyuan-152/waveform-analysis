import { describe, expect, it } from 'vitest'
import { normalizeData } from '../../../src/display/data/normalize'

describe('normalizeData', () => {
  it('removes invalid points', () => {
    const result = normalizeData([
      { x: 0, y: 1 },
      { x: Number.NaN, y: 2 },
      { x: 2, y: Number.POSITIVE_INFINITY },
      { x: 3, y: 4 },
    ])

    expect(result[0].data).toEqual([
      { x: 0, y: 1 },
      { x: 3, y: 4 },
    ])
  })

  it('sorts series by order', () => {
    const result = normalizeData([
      { name: 'B', order: 2, data: [{ x: 0, y: 2 }] },
      { name: 'A', order: 1, data: [{ x: 0, y: 1 }] },
    ])

    expect(result.map((series) => series.name)).toEqual(['A', 'B'])
  })
})

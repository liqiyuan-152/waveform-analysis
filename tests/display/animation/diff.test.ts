import { describe, expect, it } from 'vitest'
import { normalizeData } from '../../../src/display/data/normalize'
import { diffPoints } from '../../../src/display/animation/presentation/PointDiff'
import { diffSeries } from '../../../src/display/animation/presentation/SeriesDiff'
import {
  interpolateGeometry,
  planGeometry,
} from '../../../src/display/animation/presentation/GeometryTransitionPlanner'

describe('animation identity and geometry', () => {
  it('preserves point IDs through normalization and matches X changes by ID', () => {
    const old = normalizeData([{ id: 'a', x: 0, y: 1 }])[0].data
    const plan = planGeometry(old, [{ id: 'a', x: 4, y: 5 }])!
    expect(interpolateGeometry(plan, 0.5)).toEqual([{ id: 'a', x: 2, y: 3 }])
  })

  it('handles sliding windows and appended points without including deleted points', () => {
    const plan = planGeometry(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      [
        { x: 1, y: 3 },
        { x: 2, y: 4 },
      ],
    )!
    expect(plan.from).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 4 },
    ])
    expect(interpolateGeometry(plan, 1)).toEqual(plan.to)
  })

  it('rejects mixed IDs, duplicates and crossing matches', () => {
    expect(diffPoints([{ id: 'a', x: 0, y: 0 }], [{ x: 0, y: 1 }])).toBeUndefined()
    expect(
      diffPoints(
        [
          { x: 0, y: 0 },
          { x: 0, y: 2 },
        ],
        [{ x: 0, y: 1 }],
      ),
    ).toBeUndefined()
    expect(
      diffPoints(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'a', x: 1, y: 1 },
        ],
        [],
      ),
    ).toBeUndefined()
    expect(
      diffPoints(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        [
          { x: 1, y: 2 },
          { x: 0, y: 3 },
        ],
      ),
    ).toBeUndefined()
  })

  it('treats blank IDs as absent and snapshots geometry', () => {
    const target = [{ id: ' ', x: 0, y: 2 }]
    const plan = planGeometry([{ x: 0, y: 0 }], target)!
    target[0].y = 100
    expect(plan.to[0].y).toBe(2)
  })

  it('matches series reordering, additions and removals in target order', () => {
    const a = { id: 'a', data: [] }
    const b = { id: 'b', data: [] }
    const c = { id: 'c', data: [] }
    expect(diffSeries([a, b], [b, c])).toEqual([
      { previous: b, target: b },
      { previous: undefined, target: c },
      { previous: a },
    ])
    expect(diffSeries([a, b], [b, a])?.map((match) => match.target?.id)).toEqual(['b', 'a'])
  })

  it('allows only a single anonymous pair and rejects partial ambiguous identity', () => {
    const anonymous = { data: [] }
    const named = { id: 'a', data: [] }
    expect(diffSeries([anonymous], [anonymous])).toHaveLength(1)
    expect(diffSeries([anonymous, named], [anonymous, named])).toBeUndefined()
    expect(diffSeries([named, named], [named])).toBeUndefined()
    expect(diffSeries([anonymous], [named])).toBeUndefined()
  })
})

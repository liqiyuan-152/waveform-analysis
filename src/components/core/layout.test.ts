import { describe, expect, it } from 'vitest'

import type { DisplaySeries, DisplayTrack } from './types'
import { buildYAxisSeriesGroups, MAX_MULTI_Y_AXIS_COUNT } from './layout'

function series(id: string, minimum: number, maximum: number): DisplaySeries {
  return {
    id,
    name: id,
    color: '#1677ff',
    points: [
      { x: 0, y: minimum },
      { x: 1, y: maximum },
    ],
    xDomain: [0, 1],
    yDomain: [minimum, maximum],
  }
}

function track(seriesList: DisplaySeries[]): DisplayTrack {
  return {
    id: 'track',
    series: seriesList,
    xDomain: [0, 1],
    yDomain: [0, 50],
  }
}

describe('multi-value Y-axis grouping', () => {
  it('keeps every overlaid series on one axis in single-axis mode', () => {
    const groups = buildYAxisSeriesGroups(
      track([series('a', 0, 1), series('b', 10, 20)]),
      'single-axis',
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.seriesList.map((item) => item.id)).toEqual(['a', 'b'])
    expect(groups[0]?.domain).toEqual([0, 50])
  })

  it('uses the reference left-right axis order and merges overflow into axis four', () => {
    const groups = buildYAxisSeriesGroups(
      track([
        series('a', 0, 1),
        series('b', 10, 11),
        series('c', 20, 21),
        series('d', 30, 31),
        series('e', 40, 50),
      ]),
      'multi-axis',
    )

    expect(groups).toHaveLength(MAX_MULTI_Y_AXIS_COUNT)
    expect(groups.map((group) => group.side)).toEqual(['left', 'left', 'right', 'right'])
    expect(groups.map((group) => group.seriesList.map((item) => item.id))).toEqual([
      ['a'],
      ['b'],
      ['c'],
      ['d', 'e'],
    ])
    expect(groups[3]?.domain[0]).toBeLessThanOrEqual(30)
    expect(groups[3]?.domain[1]).toBeGreaterThanOrEqual(50)
  })

  it('derives merged multi-axis domains from precomputed series domains', () => {
    const first = series('a', -20, -10)
    const second = series('b', 40, 60)
    first.points = [{ x: 0, y: -15 }]
    second.points = [{ x: 0, y: 50 }]

    const groups = buildYAxisSeriesGroups(
      track([
        series('left', 0, 1),
        series('middle', 10, 11),
        series('right', 20, 21),
        first,
        second,
      ]),
      'multi-axis',
    )

    expect(groups[3]?.domain[0]).toBeLessThanOrEqual(-20)
    expect(groups[3]?.domain[1]).toBeGreaterThanOrEqual(60)
  })

  it('places two and three axes on the expected sides', () => {
    const source = [series('a', 0, 1), series('b', 10, 11), series('c', 20, 21)]

    expect(
      buildYAxisSeriesGroups(track(source.slice(0, 2)), 'multi-axis').map((g) => g.side),
    ).toEqual(['left', 'right'])
    expect(buildYAxisSeriesGroups(track(source), 'multi-axis').map((g) => g.side)).toEqual([
      'left',
      'right',
      'right',
    ])
  })
})

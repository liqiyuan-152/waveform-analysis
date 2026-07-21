import { zoomIdentity } from 'd3'
import { describe, expect, it } from 'vitest'

import { DEFAULT_WAVEFORM_RENDERING_OPTIONS } from '../../core'
import type { DisplaySeries, DisplayTrack } from './types'
import {
  buildTrackLayouts,
  buildYAxisSeriesGroups,
  MAX_MULTI_Y_AXIS_COUNT,
  measureYAxisGroupClearance,
} from './layout'

function series(id: string, minimum: number, maximum: number): DisplaySeries {
  return {
    id,
    name: id,
    color: '#1677ff',
    lineType: 'linear',
    pointType: 'none',
    errorBar: { visible: false, width: 1.5, capWidth: 8 },
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
    visibleSeries: seriesList,
    xDomain: [0, 1],
    yDomain: [0, 50],
  }
}

function layoutForSeries(
  sourceSeries: DisplaySeries,
  rendering = DEFAULT_WAVEFORM_RENDERING_OPTIONS,
  transform = zoomIdentity,
) {
  const sourceTrack = track([sourceSeries])
  sourceTrack.xDomain = sourceSeries.xDomain
  sourceTrack.yDomain = sourceSeries.yDomain
  return buildTrackLayouts({
    cells: [
      {
        slotIndex: 0,
        row: 0,
        column: 0,
        left: 0,
        top: 0,
        width: 120,
        height: 100,
        plotHeight: 100,
        cellHeight: 130,
        xAxisBand: 30,
        series: sourceTrack,
      },
    ],
    grid: { rowCount: 1, columnCount: 1, showPagination: false },
    displayMode: 'independent',
    overlayMode: 'single-axis',
    independentTransforms: [transform],
    sharedZoomDomain: sourceSeries.xDomain,
    yDomains: undefined,
    timeUnit: 'ms',
    rendering,
    hideSecondaryLabels: false,
    yAxisLabelX: -50,
    showCompactEmptyTracks: false,
  })[0]!.seriesPaths[0]!
}

describe('multi-value Y-axis grouping', () => {
  it('uses a configured visible Y domain for axis and series scales', () => {
    const source = series('a', 0, 100)
    const sourceTrack = track([source])
    const result = buildTrackLayouts({
      cells: [
        {
          slotIndex: 0,
          row: 0,
          column: 0,
          left: 0,
          top: 0,
          width: 120,
          height: 100,
          plotHeight: 100,
          cellHeight: 130,
          xAxisBand: 30,
          series: sourceTrack,
        },
      ],
      grid: { rowCount: 1, columnCount: 1, showPagination: false },
      displayMode: 'independent',
      overlayMode: 'single-axis',
      independentTransforms: [zoomIdentity],
      sharedZoomDomain: [0, 1],
      yDomains: { track: [25, 75] },
      timeUnit: 'ms',
      rendering: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      hideSecondaryLabels: false,
      yAxisLabelX: -50,
      showCompactEmptyTracks: false,
    })[0]

    expect(result?.yScale.domain()).toEqual([25, 75])
    expect(result?.seriesPaths[0]?.yScale.domain()).toEqual([25, 75])
  })

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

  it('places left and right scientific exponents eight pixels outside their tick labels', () => {
    const layout = buildTrackLayouts({
      cells: [
        {
          slotIndex: 0,
          row: 0,
          column: 0,
          left: 0,
          top: 0,
          width: 600,
          height: 300,
          plotHeight: 300,
          cellHeight: 330,
          xAxisBand: 30,
          series: track([series('left', 0, 254), series('right', 0, 254)]),
        },
      ],
      grid: { rowCount: 1, columnCount: 1, showPagination: false },
      displayMode: 'independent',
      overlayMode: 'multi-axis',
      independentTransforms: [zoomIdentity],
      sharedZoomDomain: [0, 1],
      timeUnit: 'ms',
      rendering: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      hideSecondaryLabels: false,
      yAxisLabelX: -50,
      showCompactEmptyTracks: false,
    })[0]

    expect(
      layout?.yAxes.map(({ side, x, exponentX, exponentLabel }) => ({
        side,
        offset: Math.abs(exponentX - x),
        exponentLabel,
      })),
    ).toEqual([
      { side: 'left', offset: 43, exponentLabel: 'E+02' },
      { side: 'right', offset: 43, exponentLabel: 'E+02' },
    ])
  })

  it('retains enough outer clearance for long scientific exponents', () => {
    const [group] = buildYAxisSeriesGroups(track([series('long', -1e120, 1e120)]), 'multi-axis')

    expect(group).toBeDefined()
    expect(measureYAxisGroupClearance(group!)).toBe(119)
  })
})

describe('decoration sampling', () => {
  const denseSeries = (): DisplaySeries => ({
    ...series('dense', -1, 1),
    pointType: 'circle',
    errorBar: { visible: true, width: 1.5, capWidth: 8 },
    points: Array.from({ length: 1_000 }, (_, index) => ({
      x: index,
      y: Math.sin(index / 20),
      error: index % 200 === 1 ? 0.1 : 0,
    })),
    xDomain: [0, 999],
  })

  it('shares prioritized source points between dense symbols and error bars', () => {
    const sourceSeries = denseSeries()
    const path = layoutForSeries(sourceSeries, {
      ...DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      pointMinSpacing: 10,
      errorBarMinSpacing: 12,
    })
    const sourceErrorPoints = sourceSeries.points.filter((point) => point.error !== 0)

    expect(path.errorBarRenderPoints).toEqual(sourceErrorPoints)
    expect(path.errorBarRenderPoints.every((point) => path.pointRenderPoints.includes(point))).toBe(
      true,
    )
    expect(path.pointRenderPoints.length).toBeLessThanOrEqual(Math.ceil(120 / 12) + 2)
  })

  it('keeps standalone, zero-error, and non-downsampled decoration behavior', () => {
    const noErrors = denseSeries()
    noErrors.points = noErrors.points.map((point) => ({ x: point.x, y: point.y }))
    const zeroErrorPath = layoutForSeries(noErrors)
    expect(zeroErrorPath.errorBarRenderPoints).toEqual([])
    expect(zeroErrorPath.pointRenderPoints.length).toBeLessThanOrEqual(Math.ceil(120 / 10) + 2)

    const errorsOnly = denseSeries()
    errorsOnly.pointType = 'none'
    const errorsOnlyPath = layoutForSeries(errorsOnly)
    expect(errorsOnlyPath.pointRenderPoints).toEqual([])
    expect(errorsOnlyPath.errorBarRenderPoints.length).toBeLessThanOrEqual(Math.ceil(120 / 12) + 2)

    const pointsOnly = denseSeries()
    pointsOnly.errorBar.visible = false
    const pointsOnlyPath = layoutForSeries(pointsOnly)
    expect(pointsOnlyPath.errorBarRenderPoints).toEqual([])
    expect(pointsOnlyPath.pointRenderPoints.length).toBeLessThanOrEqual(Math.ceil(120 / 10) + 2)

    const completePath = layoutForSeries(denseSeries(), {
      ...DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      downsample: false,
    })
    expect(completePath.pointRenderPoints).toHaveLength(1_000)
    expect(completePath.errorBarRenderPoints).toHaveLength(5)
  })

  it('restores every visible source decoration after zooming to sparse spacing', () => {
    const path = layoutForSeries(
      denseSeries(),
      DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      zoomIdentity.scale(200),
    )

    expect(path.pointRenderPoints.map((point) => point.x)).toEqual([0, 1, 2, 3, 4])
    expect(path.errorBarRenderPoints.map((point) => point.x)).toEqual([1])
  })
})

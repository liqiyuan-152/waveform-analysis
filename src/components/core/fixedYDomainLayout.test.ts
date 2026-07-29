import { zoomIdentity } from 'd3'
import { describe, expect, it } from 'vitest'

import { DEFAULT_WAVEFORM_RENDERING_OPTIONS } from '../../core'
import type { DisplaySeries, DisplayTrack } from './types'
import { buildTrackLayouts, resolveYAxisSeriesGroups } from './layout'

function series(id: string, minimum: number, maximum: number): DisplaySeries {
  return {
    id,
    name: id,
    color: '#1677ff',
    lineType: 'linear',
    lineStyle: 'solid',
    pointType: 'none',
    errorBar: { visible: false, width: 1.5, capWidth: 8 },
    points: [
      { x: 0, y: minimum },
      { x: 1, y: maximum },
    ],
    xDomain: [0, 1],
    yDomain: [minimum, maximum],
    hasErrorPoints: false,
  }
}

function track(seriesList: DisplaySeries[]): DisplayTrack {
  return {
    id: 'track',
    series: seriesList,
    visibleSeries: seriesList,
    xDomain: [0, 1],
    yDomain: [0, 100],
  }
}

describe('fixed Y-domain layout', () => {
  it('uses an exact global fixed domain without applying nice bounds', () => {
    const sourceTrack = track([series('a', 0, 100)])
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
      grid: { rowCount: 1, columnCount: 1, showPagination: false, trackLines: {} },
      displayMode: 'independent',
      overlayMode: 'single-axis',
      independentTransforms: [zoomIdentity],
      sharedZoomDomain: [0, 1],
      fixedYDomain: [3, 97],
      timeUnit: 'ms',
      rendering: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      hideSecondaryLabels: false,
      yAxisLabelX: -50,
      showCompactEmptyTracks: false,
    })[0]

    expect(result?.yScale.domain()).toEqual([3, 97])
    expect(result?.yAxes[0]?.tickValues).toContain(3)
    expect(result?.yAxes[0]?.tickValues).toContain(97)
    expect(result?.seriesPaths[0]?.yScale.domain()).toEqual([3, 97])
  })

  it('resolves track, series, and global fixed-domain precedence', () => {
    const sourceTrack = track([series('a', 0, 10), series('b', 20, 30)])

    expect(
      resolveYAxisSeriesGroups(sourceTrack, 'single-axis', [-5, 5], {
        a: [-10, 10],
        track: [300, 100],
      })[0]?.domain,
    ).toEqual([100, 300])

    expect(
      resolveYAxisSeriesGroups(sourceTrack, 'single-axis', [-5, 5], {
        a: [-10, 10],
      })[0]?.domain,
    ).toEqual([-10, 10])
  })

  it('keeps per-series fixed domains on separate axes and merges axis overflow', () => {
    const sourceTrack = track([
      series('a', 0, 1),
      series('b', 10, 11),
      series('c', 20, 21),
      series('d', 30, 31),
      series('e', 40, 41),
    ])
    const groups = resolveYAxisSeriesGroups(sourceTrack, 'multi-axis', undefined, {
      a: [-1, 1],
      b: [-2, 2],
      c: [-3, 3],
      d: [-4, 4],
      e: [-5, 5],
    })

    expect(groups.map((group) => group.domain)).toEqual([
      [-1, 1],
      [-2, 2],
      [-3, 3],
      [-5, 5],
    ])
    expect(groups.every((group) => group.fixed)).toBe(true)
  })
})

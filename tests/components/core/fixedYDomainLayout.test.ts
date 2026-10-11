import { zoomIdentity } from 'd3'
import { describe, expect, it } from 'vitest'

import { DEFAULT_WAVEFORM_RENDERING_OPTIONS } from '@/core'
import type { DisplaySeries, DisplayTrack } from '@/components/core/types'
import {
  buildTrackLayouts,
  resolveYAxisSeriesGroups,
  resolveRenderedYAxisSeriesGroups,
} from '@/components/core/layout'

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
  it.each(['independent', 'separated', 'compact'] as const)(
    'adds ten percent above automatic domains in %s mode',
    (displayMode) => {
      const sourceTrack = track([series('a', -20, 80), series('b', -200, -100)])
      sourceTrack.yDomain = [-200, 80]
      for (const overlayMode of ['single-axis', 'multi-axis'] as const) {
        const result = buildTrackLayouts({
          cells: [
            {
              slotIndex: 0,
              row: 0,
              column: 0,
              left: 0,
              top: 0,
              width: 300,
              height: 130,
              plotHeight: 100,
              cellHeight: 130,
              xAxisBand: 30,
              series: sourceTrack,
            },
          ],
          grid: {
            rowCount: 1,
            columnCount: 1,
            showPagination: false,
            fillIncompleteLastRow: false,
            trackLines: {},
          },
          displayMode,
          overlayMode,
          independentTransforms: [zoomIdentity],
          sharedZoomDomain: [0, 1],
          timeUnit: 'ms',
          rendering: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
          hideSecondaryLabels: false,
          yAxisLabelX: -50,
          showCompactEmptyTracks: false,
          yAxisNice: false,
          yAxisUpperPaddingRatio: 0.1,
        })[0]!
        expect(result.yAxes.map((axis) => axis.scale.domain())).toEqual(
          overlayMode === 'single-axis'
            ? [[-200, 108]]
            : [
                [-20, 90],
                [-200, -90],
              ],
        )
      }
    },
  )

  it('preserves explicit fixed ranges and manually zoomed Y viewports', () => {
    const sourceTrack = track([series('a', 0, 100)])
    expect(
      resolveRenderedYAxisSeriesGroups(
        sourceTrack,
        'single-axis',
        [0, 80],
        undefined,
        undefined,
        0.1,
      )[0]?.domain,
    ).toEqual([0, 80])
    expect(
      resolveRenderedYAxisSeriesGroups(
        sourceTrack,
        'single-axis',
        undefined,
        undefined,
        { track: [20, 40] },
        0.1,
      )[0]?.domain,
    ).toEqual([20, 40])
  })

  it.each([0, -0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'keeps automatic ranges unchanged for invalid or zero padding %s',
    (ratio) => {
      const sourceTrack = track([series('a', 0, 100)])
      expect(
        resolveRenderedYAxisSeriesGroups(
          sourceTrack,
          'single-axis',
          undefined,
          undefined,
          undefined,
          ratio,
        )[0]?.domain,
      ).toEqual([0, 100])
    },
  )

  it('expands a global fixed domain to nice equal intervals', () => {
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
      grid: {
        rowCount: 1,
        columnCount: 1,
        showPagination: false,
        fillIncompleteLastRow: false,
        trackLines: {},
      },
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

    expect(result?.yScale.domain()).toEqual([0, 100])
    expect(result?.yAxes[0]?.tickValues).toContain(0)
    expect(result?.yAxes[0]?.tickValues).toContain(100)
    expect(result?.seriesPaths[0]?.yScale.domain()).toEqual([0, 100])
  })

  it('uses the configured split number for fixed domains', () => {
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
          series: track([series('a', 0, 100)]),
        },
      ],
      grid: {
        rowCount: 1,
        columnCount: 1,
        showPagination: false,
        fillIncompleteLastRow: false,
        trackLines: {},
      },
      displayMode: 'independent',
      overlayMode: 'single-axis',
      independentTransforms: [zoomIdentity],
      sharedZoomDomain: [0, 1],
      fixedYDomain: [3, 97],
      yAxisSplitNumber: 5,
      timeUnit: 'ms',
      rendering: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      hideSecondaryLabels: false,
      yAxisLabelX: -50,
      showCompactEmptyTracks: false,
    })[0]

    expect(result?.yAxes[0]?.majorTicks).toEqual([0, 20, 40, 60, 80, 100])
  })

  it('defaults to five ticks and supports a two-tick axis', () => {
    const build = (splitNumber?: number) =>
      buildTrackLayouts({
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
            series: track([series('a', 3, 97)]),
          },
        ],
        grid: {
          rowCount: 1,
          columnCount: 1,
          showPagination: false,
          fillIncompleteLastRow: false,
          trackLines: {},
        },
        displayMode: 'independent',
        overlayMode: 'single-axis',
        independentTransforms: [zoomIdentity],
        sharedZoomDomain: [0, 1],
        fixedYDomain: [3, 97],
        yAxisSplitNumber: splitNumber,
        timeUnit: 'ms',
        rendering: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
        hideSecondaryLabels: false,
        yAxisLabelX: -50,
        showCompactEmptyTracks: false,
      })[0]?.yAxes[0]?.majorTicks

    expect(build()).toHaveLength(6)
    expect(build(2)).toEqual([0, 100])
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

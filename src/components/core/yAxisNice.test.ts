import { zoomIdentity } from 'd3'
import { describe, expect, it } from 'vitest'

import { DEFAULT_WAVEFORM_RENDERING_OPTIONS } from '../../core'
import type { WaveformData } from '../../types'
import { buildTrackLayouts } from './trackLayoutBuilder'
import type { DisplaySeries, DisplayTrack } from './types'
import { prepareWaveformSeries } from './useWaveformData'

function displaySeries(id: string, domain: [number, number]): DisplaySeries {
  return {
    id,
    name: id,
    color: '#1677ff',
    lineType: 'linear',
    lineStyle: 'solid',
    pointType: 'none',
    errorBar: { visible: false, width: 1.5, capWidth: 8 },
    points: [
      { x: 0, y: domain[0] },
      { x: 1, y: domain[1] },
    ],
    xDomain: [0, 1],
    yDomain: domain,
    hasErrorPoints: false,
  }
}

function layout(
  series: DisplaySeries[],
  options: { overlayMode?: 'single-axis' | 'multi-axis'; fixedYDomain?: [number, number] } = {},
) {
  const track: DisplayTrack = {
    id: 'track',
    series,
    visibleSeries: series,
    xDomain: [0, 1],
    yDomain: [
      Math.min(...series.map((item) => item.yDomain[0])),
      Math.max(...series.map((item) => item.yDomain[1])),
    ],
  }
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
        series: track,
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
    overlayMode: options.overlayMode ?? 'single-axis',
    independentTransforms: [zoomIdentity],
    sharedZoomDomain: [0, 1],
    fixedYDomain: options.fixedYDomain,
    timeUnit: 'ms',
    rendering: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
    hideSecondaryLabels: false,
    yAxisLabelX: -50,
    yAxisNice: false,
    showCompactEmptyTracks: false,
  })[0]!
}

describe('Y-axis nice domains', () => {
  it('defaults to a nice domain and can preserve the actual data endpoints', () => {
    const source = displaySeries('source', [3, 97])
    const track: DisplayTrack = {
      id: 'track',
      series: [source],
      visibleSeries: [source],
      xDomain: [0, 1],
      yDomain: [3, 97],
    }
    const defaults = buildTrackLayouts({
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
          series: track,
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
      timeUnit: 'ms',
      rendering: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      hideSecondaryLabels: false,
      yAxisLabelX: -50,
      showCompactEmptyTracks: false,
    })[0]!

    expect(defaults.yScale.domain()).toEqual([0, 100])
    expect(layout([source]).yScale.domain()).toEqual([3, 97])
  })

  it('merges visible single-axis series but keeps multi-axis series independent', () => {
    const first = displaySeries('first', [3, 40])
    const second = displaySeries('second', [10, 97])

    expect(layout([first, second]).yScale.domain()).toEqual([3, 97])
    expect(
      layout([first, second], { overlayMode: 'multi-axis' }).yAxes.map((axis) =>
        axis.scale.domain(),
      ),
    ).toEqual([
      [3, 40],
      [10, 97],
    ])
  })

  it('keeps explicit domains and constant-data safety ranges unchanged', () => {
    expect(
      layout([displaySeries('source', [3, 97])], { fixedYDomain: [3, 97] }).yScale.domain(),
    ).toEqual([3, 97])
    expect(layout([displaySeries('constant', [9.5, 10.5])]).yScale.domain()).toEqual([9.5, 10.5])
  })

  it('continues to include visible error-bar bounds in the preserved domain', () => {
    const input: WaveformData = {
      kind: 'series',
      series: [
        {
          id: 'error-series',
          name: 'error series',
          errorBar: { visible: true },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 3, lowerError: 2 },
              { x: 1, y: 7, upperError: 4 },
            ],
          },
        },
      ],
    }
    const [prepared] = prepareWaveformSeries(input)
    const errorSeries: DisplaySeries = { ...prepared!, color: prepared!.color ?? '#1677ff' }

    expect(prepared?.yDomain).toEqual([1, 11])
    expect(layout([errorSeries]).yScale.domain()).toEqual([1, 11])
  })
})

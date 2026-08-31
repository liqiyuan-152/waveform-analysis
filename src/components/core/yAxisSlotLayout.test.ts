import { zoomIdentity } from 'd3'
import { describe, expect, it } from 'vitest'

import { DEFAULT_WAVEFORM_RENDERING_OPTIONS } from '../../core'
import { buildTrackLayouts, buildYAxisSlots } from './layout'
import type { DisplaySeries, DisplayTrack } from './types'
import { Y_AXIS_RIGHT_LABEL_OFFSET } from './yAxisConstants'

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
    id: seriesList[0]!.id,
    series: seriesList,
    visibleSeries: seriesList,
    xDomain: [0, 1],
    yDomain: [0, 1],
  }
}

describe('Y-axis slots', () => {
  it('aligns matching slots across single and multi-axis tracks', () => {
    const tracks = [
      track([series('single', -1e120, 1e120)]),
      track([series('left', 0, 1), series('right', 1000, 3000)]),
      track([series('left-two', 0, 1), series('right-two', 1000, 3000)]),
    ]
    const yAxisSlots = buildYAxisSlots(tracks, 'multi-axis')
    const layouts = buildTrackLayouts({
      cells: tracks.map((series, index) => ({
        slotIndex: index,
        row: index,
        column: 0,
        left: 0,
        top: index * 100,
        width: 600,
        height: 100,
        plotHeight: 100,
        cellHeight: 130,
        xAxisBand: 30,
        series,
      })),
      grid: {
        rowCount: 3,
        columnCount: 1,
        showPagination: false,
        fillIncompleteLastRow: false,
        trackLines: {},
      },
      displayMode: 'independent',
      overlayMode: 'multi-axis',
      independentTransforms: [zoomIdentity, zoomIdentity, zoomIdentity],
      sharedZoomDomain: [0, 1],
      timeUnit: 'ms',
      rendering: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      hideSecondaryLabels: false,
      yAxisLabelX: yAxisSlots.slots.find((slot) => slot.side === 'left')!.labelOffset,
      yAxisSlots: yAxisSlots.slots,
      showCompactEmptyTracks: false,
    })

    expect(layouts.map((layout) => layout.yAxes[0]?.labelX)).toEqual([
      layouts[0]?.yAxes[0]?.labelX,
      layouts[0]?.yAxes[0]?.labelX,
      layouts[0]?.yAxes[0]?.labelX,
    ])
    expect(layouts[1]?.yAxes[1]?.labelX).toBe(layouts[2]?.yAxes[1]?.labelX)
    expect(layouts[1]?.yAxes[1]?.labelX).toBe(
      600 +
        yAxisSlots.slots.find((slot) => slot.side === 'right')!.labelOffset -
        Y_AXIS_RIGHT_LABEL_OFFSET,
    )
    expect(yAxisSlots.slots).toMatchObject([
      { side: 'left', sideIndex: 0, axisOffset: 0 },
      { side: 'right', sideIndex: 0, axisOffset: 0 },
    ])
    expect(yAxisSlots.clearance.left).toBeGreaterThan(yAxisSlots.clearance.right)
  })

  it('reserves outward second slots for three and four value axes', () => {
    const threeAxisSlots = buildYAxisSlots(
      [track([series('left', 0, 1), series('right-one', 10, 20), series('right-two', 30, 40)])],
      'multi-axis',
    )
    const fourAxisSlots = buildYAxisSlots(
      [
        track([
          series('left-one', 0, 1),
          series('left-two', 10, 20),
          series('right-one', 30, 40),
          series('right-two', 50, 60),
        ]),
      ],
      'multi-axis',
    )

    expect(threeAxisSlots.slots).toMatchObject([
      { side: 'left', sideIndex: 0, axisOffset: 0 },
      { side: 'right', sideIndex: 0, axisOffset: 0 },
      { side: 'right', sideIndex: 1 },
    ])
    expect(threeAxisSlots.slots[2]!.axisOffset).toBeGreaterThan(0)
    expect(fourAxisSlots.slots).toMatchObject([
      { side: 'left', sideIndex: 0, axisOffset: 0 },
      { side: 'left', sideIndex: 1 },
      { side: 'right', sideIndex: 0, axisOffset: 0 },
      { side: 'right', sideIndex: 1 },
    ])
    expect(fourAxisSlots.slots[1]!.axisOffset).toBeLessThan(0)
    expect(fourAxisSlots.slots[3]!.axisOffset).toBeGreaterThan(0)
  })
})

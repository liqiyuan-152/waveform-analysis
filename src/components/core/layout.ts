import { line, scaleLinear, zoomIdentity, type ZoomTransform } from 'd3'

import { selectRenderablePoints, type ResolvedWaveformRenderingOptions } from '../../core'
import type { WaveformDisplayMode, WaveformPoint } from '../../types'
import { buildMinorTicks, formatEndpointTime } from '../../utils'
import {
  getBottomRowCellIndexes,
  type GridCellGeometry,
  type NormalizedWaveformGridOptions,
} from './grid'
import type { DisplaySeries, DisplayTrack, TrackLayout } from './types'

interface SeriesGridCell extends GridCellGeometry {
  series?: DisplayTrack
}

export interface BuildTrackLayoutsOptions {
  cells: SeriesGridCell[]
  grid: NormalizedWaveformGridOptions
  displayMode: WaveformDisplayMode
  independentTransforms: ZoomTransform[]
  sharedZoomDomain: [number, number]
  timeUnit: 's' | 'ms'
  rendering: ResolvedWaveformRenderingOptions
  hideSecondaryLabels: boolean
  yAxisLabelX: number
  showCompactEmptyTracks: boolean
}

export function buildTrackLayouts(options: BuildTrackLayoutsOptions): TrackLayout[] {
  const visibleCells = options.cells.map((cell) => ({ ...cell, hasSeries: Boolean(cell.series) }))
  const bottomCells = getBottomRowCellIndexes(visibleCells, options.grid.columnCount)

  return visibleCells.flatMap((cell, index) => {
    const isEmpty = !cell.series
    if (isEmpty && (options.displayMode !== 'compact' || !options.showCompactEmptyTracks)) return []
    const emptySeries: DisplaySeries = {
      id: `empty-grid-slot-${cell.slotIndex}`,
      name: '',
      color: 'transparent',
      points: [],
      xDomain: [0, 1],
      yDomain: [0, 1],
    }
    const displayTrack: DisplayTrack = cell.series ?? {
      id: emptySeries.id,
      series: [emptySeries],
      xDomain: emptySeries.xDomain,
      yDomain: emptySeries.yDomain,
    }
    const series = displayTrack.series[0]
    const baseXScale =
      options.displayMode === 'independent'
        ? scaleLinear(displayTrack.xDomain, [0, cell.width])
        : scaleLinear(options.sharedZoomDomain, [0, cell.width])
    const transform =
      options.displayMode === 'independent'
        ? (options.independentTransforms[index] ?? zoomIdentity)
        : zoomIdentity
    const xScale = transform.rescaleX(baseXScale)
    const yScale = scaleLinear(displayTrack.yDomain, [cell.plotHeight, 0]).nice()
    const xMajorTicks = xScale.ticks(Math.max(2, Math.floor(cell.width / 100)))
    const yMajorTicks = yScale.ticks(Math.max(2, Math.floor(cell.plotHeight / 55)))
    const [yAxisStart, yAxisEnd] = yScale.domain()
    const showYAxisEnd = options.displayMode !== 'compact' || cell.row === 0
    const visibleYMajorTicks = showYAxisEnd
      ? yMajorTicks
      : yMajorTicks.filter((tick) => tick !== yAxisEnd)
    const yAxisTickValues = Array.from(
      new Set([yAxisStart, ...visibleYMajorTicks, ...(showYAxisEnd ? [yAxisEnd] : [])]),
    )
    const domain = xScale.domain() as [number, number]
    const endpointLabels = {
      start: formatEndpointTime(domain[0], domain, options.timeUnit),
      end: formatEndpointTime(domain[1], domain, options.timeUnit),
    }
    const leftClearance = endpointLabels.start.length * 7 + 10
    const rightClearance = endpointLabels.end.length * 7 + 10
    const xAxisTickValues = xMajorTicks.filter((tick) => {
      const position = xScale(tick)
      return position > leftClearance && position < cell.width - rightClearance
    })
    const seriesPaths = displayTrack.series.map((trackSeries) => {
      const renderPoints = selectRenderablePoints(
        trackSeries.points,
        domain,
        cell.width,
        options.rendering,
      )
      return {
        series: trackSeries,
        path: isEmpty
          ? null
          : line<WaveformPoint>()
              .x((point) => xScale(point.x))
              .y((point) => yScale(point.y))(renderPoints),
      }
    })

    return {
      index,
      series,
      seriesList: displayTrack.series,
      isEmpty,
      column: cell.column,
      showYAxisLabel: !options.hideSecondaryLabels || cell.column === 0,
      yAxisLabelX: options.yAxisLabelX,
      left: cell.left,
      top: cell.top,
      width: cell.width,
      height: cell.plotHeight,
      xScale,
      yScale,
      xMajorTicks,
      xMinorTicks: buildMinorTicks(xMajorTicks, 5, domain),
      yMajorTicks,
      yMinorTicks: buildMinorTicks(yMajorTicks),
      yAxisTickValues,
      xAxisTickValues,
      endpointLabels,
      path: seriesPaths[0]?.path ?? null,
      seriesPaths,
      showXAxis:
        options.displayMode === 'independent' ||
        (options.displayMode === 'compact'
          ? cell.row === options.grid.rowCount - 1
          : bottomCells.has(cell.slotIndex)),
    }
  })
}

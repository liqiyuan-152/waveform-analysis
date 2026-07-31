import {
  curveStep,
  curveStepAfter,
  curveStepBefore,
  line,
  scaleLinear,
  zoomIdentity,
  type ZoomTransform,
} from 'd3'

import {
  selectSeriesRenderPoints,
  type ResolvedWaveformRenderingOptions,
} from '../../core/rendering'
import type { WaveformDisplayMode, WaveformOverlayMode, WaveformPoint } from '../../types'
import { buildMinorTicks, formatAxisTimeExponent, formatEndpointTime } from '../../utils'
import {
  getBottomRowCellIndexes,
  type GridCellGeometry,
  type NormalizedWaveformGridOptions,
} from './grid'
import { axisTextMetrics, resolveYAxisSeriesGroups } from './layout'
import type { DisplaySeries, DisplayTrack, TrackLayout, WaveformYAxisLayout } from './types'
import { Y_AXIS_EXPONENT_GAP } from './constants'
import {
  Y_AXIS_LABEL_BAND_WIDTH,
  Y_AXIS_LABEL_GAP,
  Y_AXIS_OUTER_PADDING,
  Y_AXIS_TICK_PADDING,
} from './yAxisConstants'

interface SeriesGridCell extends GridCellGeometry {
  series?: DisplayTrack
}

export interface BuildTrackLayoutsOptions {
  cells: SeriesGridCell[]
  grid: NormalizedWaveformGridOptions
  displayMode: WaveformDisplayMode
  overlayMode: WaveformOverlayMode
  independentTransforms: ZoomTransform[]
  sharedZoomDomain: [number, number]
  initialXDomain?: [number, number]
  initialXDomains?: Record<string, [number, number]>
  fixedYDomain?: [number, number]
  fixedYDomains?: Record<string, [number, number]>
  yDomains?: Record<string, [number, number]>
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
      lineType: 'linear',
      lineStyle: 'solid',
      pointType: 'none',
      errorBar: { visible: false, width: 1.5, capWidth: 8 },
      points: [],
      xDomain: [0, 1],
      yDomain: [0, 1],
      hasErrorPoints: false,
    }
    const displayTrack: DisplayTrack = cell.series ?? {
      id: emptySeries.id,
      series: [emptySeries],
      visibleSeries: [emptySeries],
      xDomain: emptySeries.xDomain,
      yDomain: emptySeries.yDomain,
    }
    const hasVisibleSeries = !isEmpty && displayTrack.visibleSeries.length > 0
    const series = displayTrack.visibleSeries[0] ?? displayTrack.series[0] ?? emptySeries
    const baseXScale =
      options.displayMode === 'independent'
        ? scaleLinear(
            options.initialXDomains?.[displayTrack.id] ??
              options.initialXDomains?.[series.id] ??
              options.initialXDomain ??
              displayTrack.xDomain,
            [0, cell.width],
          )
        : scaleLinear(options.sharedZoomDomain, [0, cell.width])
    const transform =
      options.displayMode === 'independent'
        ? (options.independentTransforms[index] ?? zoomIdentity)
        : zoomIdentity
    const xScale = transform.rescaleX(baseXScale)
    const configuredYDomain = options.yDomains?.[displayTrack.id]
    const yAxisGroups = resolveYAxisSeriesGroups(
      displayTrack,
      options.overlayMode,
      options.fixedYDomain,
      options.fixedYDomains,
    ).map((group) =>
      !group.fixed && configuredYDomain ? { ...group, domain: configuredYDomain } : group,
    )
    const sideOffsets = { left: 0, right: 0 }
    const yAxes: WaveformYAxisLayout[] = yAxisGroups.map((group) => {
      const scale = scaleLinear(group.domain, [cell.plotHeight, 0])
      if (!group.fixed) scale.nice()
      const majorTicks = scale.ticks(Math.max(2, Math.floor(cell.plotHeight / 55)))
      const [axisStart, axisEnd] = scale.domain()
      const showAxisEnd = options.displayMode !== 'compact' || cell.row === 0
      const visibleMajorTicks = showAxisEnd
        ? majorTicks
        : majorTicks.filter((tick) => tick !== axisEnd)
      const tickValues = Array.from(
        new Set([axisStart, ...visibleMajorTicks, ...(showAxisEnd ? [axisEnd] : [])]),
      )
      const { exponentLabel, exponentWidth, tickTextWidth } = axisTextMetrics(
        group.domain,
        !group.fixed,
      )
      const exponentClearance = exponentLabel ? exponentWidth + Y_AXIS_EXPONENT_GAP : 0
      const clearance =
        tickTextWidth +
        Y_AXIS_TICK_PADDING +
        exponentClearance +
        Y_AXIS_LABEL_GAP +
        Y_AXIS_LABEL_BAND_WIDTH +
        Y_AXIS_OUTER_PADDING
      const x = group.side === 'left' ? -sideOffsets.left : cell.width + sideOffsets.right
      const exponentX =
        x +
        (group.side === 'left'
          ? -(Y_AXIS_TICK_PADDING + tickTextWidth + Y_AXIS_EXPONENT_GAP)
          : Y_AXIS_TICK_PADDING + tickTextWidth + Y_AXIS_EXPONENT_GAP)
      const labelDistance =
        tickTextWidth +
        Y_AXIS_TICK_PADDING +
        exponentClearance +
        exponentWidth +
        Y_AXIS_LABEL_GAP +
        Y_AXIS_LABEL_BAND_WIDTH / 2
      const labelX = x + (group.side === 'left' ? -labelDistance : labelDistance)
      sideOffsets[group.side] += clearance
      return {
        index: group.index,
        side: group.side,
        x,
        labelX,
        exponentX,
        exponentLabel,
        scale,
        majorTicks,
        minorTicks: buildMinorTicks(majorTicks),
        tickValues,
        seriesList: group.seriesList,
      }
    })
    const yScale = yAxes[0]?.scale ?? scaleLinear(displayTrack.yDomain, [cell.plotHeight, 0]).nice()
    const xMajorTicks = xScale.ticks(Math.max(2, Math.floor(cell.width / 100)))
    const yMajorTicks = yAxes[0]?.majorTicks ?? []
    const yAxisTickValues = yAxes[0]?.tickValues ?? []
    const domain = xScale.domain() as [number, number]
    const endpointLabels = {
      start: formatEndpointTime(domain[0], domain, options.timeUnit),
      end: formatEndpointTime(domain[1], domain, options.timeUnit),
    }
    const xAxisExponent = formatAxisTimeExponent(domain, options.timeUnit)
    const leftClearance = endpointLabels.start.length * 7 + 10
    const rightClearance = endpointLabels.end.length * 7 + 10
    const xAxisTickValues = xMajorTicks.filter((tick) => {
      const position = xScale(tick)
      return position > leftClearance && position < cell.width - rightClearance
    })
    const seriesPaths = displayTrack.visibleSeries.map((trackSeries) => {
      const yAxis = yAxes.find((axis) =>
        axis.seriesList.some((series) => series.id === trackSeries.id),
      )
      const seriesYScale = yAxis?.scale ?? yScale
      const renderPoints = selectSeriesRenderPoints(
        trackSeries.points,
        domain,
        cell.width,
        options.rendering,
        {
          lineVisible: !isEmpty && trackSeries.lineType !== 'none',
          pointVisible: trackSeries.pointType !== 'none',
          errorBarVisible: trackSeries.errorBar.visible,
          hasErrorPoints: trackSeries.hasErrorPoints,
        },
      )
      const pathGenerator = line<WaveformPoint>()
        .x((point) => xScale(point.x))
        .y((point) => seriesYScale(point.y))
      if (trackSeries.lineType === 'step-start') pathGenerator.curve(curveStepBefore)
      if (trackSeries.lineType === 'step-middle') pathGenerator.curve(curveStep)
      if (trackSeries.lineType === 'step-end' || trackSeries.lineType === 'step-after') {
        pathGenerator.curve(curveStepAfter)
      }
      return {
        series: trackSeries,
        path: renderPoints.linePoints.length ? pathGenerator(renderPoints.linePoints) : null,
        pointRenderPoints: renderPoints.pointRenderPoints,
        errorBarRenderPoints: renderPoints.errorBarRenderPoints,
        yScale: seriesYScale,
        yAxisIndex: yAxis?.index ?? 0,
      }
    })

    return {
      id: displayTrack.id,
      index,
      series,
      seriesList: displayTrack.visibleSeries,
      legendSeries: displayTrack.series,
      isEmpty,
      hasVisibleSeries,
      column: cell.column,
      showYAxisLabel: !options.hideSecondaryLabels || cell.column === 0,
      yAxisLabelX: options.yAxisLabelX,
      left: cell.left,
      top: cell.top,
      width: cell.width,
      height: cell.plotHeight,
      xScale,
      yScale,
      yAxes,
      xMajorTicks,
      xMinorTicks: buildMinorTicks(xMajorTicks, 5, domain),
      yMajorTicks,
      yMinorTicks: yAxes[0]?.minorTicks ?? [],
      yAxisTickValues,
      xAxisTickValues,
      endpointLabels,
      xAxisExponent,
      path: seriesPaths[0]?.path ?? null,
      seriesPaths,
      gridLines: options.grid.trackLines[displayTrack.id] ?? {
        horizontal: true,
        vertical: true,
      },
      showXAxis:
        (isEmpty || hasVisibleSeries) &&
        (options.displayMode === 'independent' ||
          (options.displayMode === 'compact'
            ? cell.row === options.grid.rowCount - 1
            : bottomCells.has(cell.slotIndex))),
    }
  })
}

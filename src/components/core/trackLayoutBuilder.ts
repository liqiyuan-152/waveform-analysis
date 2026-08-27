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
import type {
  WaveformDisplayMode,
  WaveformOverlayMode,
  WaveformPoint,
  WaveformXDomainStrategy,
  WaveformXAxisLabelFormatter,
} from '../../types'
import { buildMinorTicks, formatXAxisLabel } from '../../utils'
import {
  getBottomRowCellIndexes,
  type GridCellGeometry,
  type NormalizedWaveformGridOptions,
} from './grid'
import { axisTextMetrics, resolveYAxisSeriesGroups, resolveYAxisTickCount } from './layout'
import type { DisplayTrack, TrackLayout, WaveformYAxisLayout } from './types'
import { applyXDomainStrategy } from './xDomain'
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
  xDomainStrategy?: WaveformXDomainStrategy
  fixedYDomain?: [number, number]
  fixedYDomains?: Record<string, [number, number]>
  yDomains?: Record<string, [number, number]>
  timeUnit: 's' | 'ms'
  xAxisLabelFormatter?: WaveformXAxisLabelFormatter
  yAxisSplitNumber?: number
  yAxisNice?: boolean
  rendering: ResolvedWaveformRenderingOptions
  hideSecondaryLabels: boolean
  yAxisLabelX: number
  showCompactEmptyTracks: boolean
}

function resolveIndependentXDomain(
  track: DisplayTrack,
  seriesId: string,
  options: BuildTrackLayoutsOptions,
): [number, number] {
  const strategy = options.xDomainStrategy ?? { type: 'data' }
  const explicitDomain =
    options.initialXDomains?.[track.id] ??
    options.initialXDomains?.[seriesId] ??
    options.initialXDomain
  return explicitDomain
    ? applyXDomainStrategy(explicitDomain, strategy, true)
    : applyXDomainStrategy(track.xDomain, strategy)
}

export function buildTrackLayouts(options: BuildTrackLayoutsOptions): TrackLayout[] {
  const visibleCells = options.cells.map((cell) => ({ ...cell, hasSeries: Boolean(cell.series) }))
  const bottomCells = getBottomRowCellIndexes(visibleCells, options.grid.columnCount)

  return visibleCells.flatMap((cell, index) => {
    const isEmpty = !cell.series || cell.series.series.length === 0
    if (!cell.series && (options.displayMode !== 'compact' || !options.showCompactEmptyTracks))
      return []
    const displayTrack: DisplayTrack = cell.series ?? {
      id: `empty-grid-slot-${cell.slotIndex}`,
      series: [],
      visibleSeries: [],
      xDomain: [0, 1],
      yDomain: [0, 1],
    }
    const hasVisibleSeries = !isEmpty && displayTrack.visibleSeries.length > 0
    const series = displayTrack.visibleSeries[0] ?? displayTrack.series[0] ?? null
    const baseXScale =
      options.displayMode === 'independent'
        ? scaleLinear(
            resolveIndependentXDomain(displayTrack, series?.id ?? displayTrack.id, options),
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
      const tickCount = resolveYAxisTickCount(cell.plotHeight, options.yAxisSplitNumber)
      const niceCount = Math.max(1, tickCount - 1)
      const scale = scaleLinear(group.domain, [cell.plotHeight, 0])
      if (options.yAxisNice !== false) scale.nice(niceCount)
      const [axisStart, axisEnd] = scale.domain()
      const majorTicks = Array.from(
        { length: tickCount },
        (_, index) => axisStart + ((axisEnd - axisStart) * index) / (tickCount - 1),
      )
      const showAxisEnd = options.displayMode !== 'compact' || cell.row === 0
      const visibleMajorTicks = showAxisEnd ? majorTicks : majorTicks.slice(0, -1)
      const tickValues = visibleMajorTicks
      const { tickTextWidth } = axisTextMetrics(
        scale.domain() as [number, number],
        false,
        tickValues,
        group.seriesList[0]?.unit,
        tickCount,
      )
      const clearance =
        tickTextWidth +
        Y_AXIS_TICK_PADDING +
        Y_AXIS_LABEL_GAP +
        Y_AXIS_LABEL_BAND_WIDTH +
        Y_AXIS_OUTER_PADDING
      const x = group.side === 'left' ? -sideOffsets.left : cell.width + sideOffsets.right
      const labelDistance =
        tickTextWidth + Y_AXIS_TICK_PADDING + Y_AXIS_LABEL_GAP + Y_AXIS_LABEL_BAND_WIDTH / 2
      const labelX = x + (group.side === 'left' ? -labelDistance : labelDistance)
      sideOffsets[group.side] += clearance
      return {
        index: group.index,
        side: group.side,
        x,
        labelX,
        scale,
        majorTicks,
        minorTicks: buildMinorTicks(majorTicks, 2),
        tickValues,
        seriesList: group.seriesList,
      }
    })
    const fallbackYScale = scaleLinear(displayTrack.yDomain, [cell.plotHeight, 0])
    if (options.yAxisNice !== false) fallbackYScale.nice()
    const yScale = yAxes[0]?.scale ?? fallbackYScale
    const xMajorTicks = xScale.ticks(Math.max(2, Math.floor(cell.width / 100)))
    const yMajorTicks = yAxes[0]?.majorTicks ?? []
    const yAxisTickValues = yAxes[0]?.tickValues ?? []
    const domain = xScale.domain() as [number, number]
    const endpointLabels = {
      start: formatXAxisLabel(
        domain[0],
        domain,
        options.timeUnit,
        'start',
        options.xAxisLabelFormatter,
      ),
      end: formatXAxisLabel(
        domain[1],
        domain,
        options.timeUnit,
        'end',
        options.xAxisLabelFormatter,
      ),
    }
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
      xMinorTicks: buildMinorTicks(xMajorTicks, 3, domain),
      yMajorTicks,
      yMinorTicks: yAxes[0]?.minorTicks ?? [],
      yAxisTickValues,
      xAxisTickValues,
      endpointLabels,
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
            ? (cell.isLastRow ?? cell.row === options.grid.rowCount - 1)
            : bottomCells.has(cell.slotIndex))),
    }
  })
}

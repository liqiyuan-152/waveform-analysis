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
import {
  axisTextMetrics,
  resolveRenderedYAxisSeriesGroups,
  resolveYAxisTicks,
  resolveYAxisTickCount,
  type YAxisSlot,
} from './layout'
import type { DisplayTrack, TrackLayout, WaveformYAxisLayout } from './types'
import { applyXDomainStrategy } from './xDomain'
import { alignLeftYAxisTitles } from './yAxisTitleLayout'
import { measureYAxisTextWidth } from './yAxisTextWidth'
import {
  alignIntegerZoomDomain,
  normalizeIntegerZoomDomain,
  integerZoomTicks,
  formatIntegerZoomLabel,
} from '../interaction/integerZoom'
import {
  Y_AXIS_LABEL_BAND_WIDTH,
  Y_AXIS_LABEL_GAP,
  Y_AXIS_OUTER_PADDING,
  Y_AXIS_RIGHT_LABEL_OFFSET,
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
  integerZoom?: boolean
  fixedYDomain?: [number, number]
  fixedYDomains?: Record<string, [number, number]>
  yDomains?: Record<string, [number, number]>
  timeUnit: 's' | 'ms'
  xAxisLabelFormatter?: WaveformXAxisLabelFormatter
  yAxisSplitNumber?: number
  yAxisNice?: boolean
  yAxisUpperPaddingRatio?: number
  rendering: ResolvedWaveformRenderingOptions
  /** Latest sampling result for SVG lines only; source series remain complete for interaction. */
  linePointOverrides?: Readonly<Record<string, WaveformPoint[]>>
  hideSecondaryLabels: boolean
  yAxisLabelX: number
  yLabel?: string
  yAxisSlots?: readonly YAxisSlot[]
  showCompactEmptyTracks: boolean
  useNonEmptyBottomTracks?: boolean
  compactYAxisLayout?: boolean
  showAxisUnits?: boolean
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
  return alignIntegerZoomDomain(
    explicitDomain
      ? applyXDomainStrategy(explicitDomain, strategy, true)
      : applyXDomainStrategy(track.xDomain, strategy),
    options,
  )
}

export function buildTrackLayouts(options: BuildTrackLayoutsOptions): TrackLayout[] {
  const visibleCells = options.cells.map((cell) => ({
    ...cell,
    hasSeries: options.useNonEmptyBottomTracks
      ? Boolean(cell.series?.series.length)
      : Boolean(cell.series),
  }))
  const bottomCells = getBottomRowCellIndexes(visibleCells, options.grid.columnCount)

  const layouts: TrackLayout[] = visibleCells.flatMap((cell, index) => {
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
    xScale.domain(normalizeIntegerZoomDomain(xScale.domain() as [number, number], options))
    const yAxisGroups = resolveRenderedYAxisSeriesGroups(
      displayTrack,
      options.overlayMode,
      options.fixedYDomain,
      options.fixedYDomains,
      options.yDomains,
      options.yAxisUpperPaddingRatio,
    )
    const sideIndexes = { left: 0, right: 0 }
    const sideOffsets = { left: 0, right: 0 }
    const yAxes: WaveformYAxisLayout[] = yAxisGroups.map((group) => {
      const sideIndex = sideIndexes[group.side]++
      const tickCount = resolveYAxisTickCount(cell.plotHeight, options.yAxisSplitNumber)
      const resolvedTicks = resolveYAxisTicks(group.domain, tickCount, options.yAxisNice !== false)
      const scale = scaleLinear(resolvedTicks.domain, [cell.plotHeight, 0])
      const majorTicks = resolvedTicks.values
      const showAxisEnd = options.displayMode !== 'compact' || cell.row === 0
      const visibleMajorTicks = showAxisEnd ? majorTicks : majorTicks.slice(0, -1)
      const tickValues = visibleMajorTicks
      const { tickTextWidth } = axisTextMetrics(
        scale.domain() as [number, number],
        false,
        tickValues,
        options.showAxisUnits !== false ? group.seriesList[0]?.unit : undefined,
        tickCount,
      )
      const clearance =
        tickTextWidth +
        Y_AXIS_TICK_PADDING +
        Y_AXIS_LABEL_GAP +
        Y_AXIS_LABEL_BAND_WIDTH +
        Y_AXIS_OUTER_PADDING
      const slot = options.yAxisSlots?.find(
        (candidate) => candidate.side === group.side && candidate.sideIndex === sideIndex,
      )
      const x = slot
        ? (group.side === 'left' ? 0 : cell.width) + slot.axisOffset
        : group.side === 'left'
          ? -sideOffsets.left
          : cell.width + sideOffsets.right
      const labelDistance =
        tickTextWidth + Y_AXIS_TICK_PADDING + Y_AXIS_LABEL_GAP + Y_AXIS_LABEL_BAND_WIDTH / 2
      const labelX =
        (slot
          ? (group.side === 'left' ? 0 : cell.width) + slot.labelOffset
          : x + (group.side === 'left' ? -labelDistance : labelDistance)) -
        (group.side === 'right' && !options.compactYAxisLayout ? Y_AXIS_RIGHT_LABEL_OFFSET : 0)
      if (!slot) sideOffsets[group.side] += clearance
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
    const xMajorTicks = integerZoomTicks(
      xScale.domain() as [number, number],
      Math.max(2, Math.floor(cell.width / 100)),
      options,
    )
    const xAxisLabelFormatter =
      options.xAxisLabelFormatter ?? (options.integerZoom ? formatIntegerZoomLabel : undefined)
    const yMajorTicks = yAxes[0]?.majorTicks ?? []
    const yAxisTickValues = yAxes[0]?.tickValues ?? []
    const domain = xScale.domain() as [number, number]
    const endpointLabels = {
      start: formatXAxisLabel(domain[0], domain, options.timeUnit, 'start', xAxisLabelFormatter),
      end: formatXAxisLabel(domain[1], domain, options.timeUnit, 'end', xAxisLabelFormatter),
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
          linePointOverride: options.linePointOverrides?.[trackSeries.id],
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
      xAxisLabelFormatter,
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
        options.displayMode === 'independent' ||
        (options.displayMode === 'compact'
          ? (cell.isLastRow ?? cell.row === options.grid.rowCount - 1)
          : bottomCells.has(cell.slotIndex)),
    }
  })

  alignLeftYAxisTitles(layouts, options.yLabel, {
    showUnits: options.showAxisUnits,
    compact: options.compactYAxisLayout,
    measureTextWidth: options.compactYAxisLayout ? measureYAxisTextWidth : undefined,
  })
  return layouts
}

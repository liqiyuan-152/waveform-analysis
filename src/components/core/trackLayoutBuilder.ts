import { generateWaveformPath } from '../animation/geometry'
import { type YAxisPaddingOptions } from './yAxisPadding'
import { resolveYAxisTickValues } from './yAxisTicks'
import { selectSeriesRenderSourcePoints } from '../../core/rendering'
import { pointSourceFromPoints } from '../../core/waveformPointSource'
import { scaleLinear, zoomIdentity, type ZoomTransform } from 'd3'

import { type ResolvedWaveformRenderingOptions } from '../../core/rendering'
import type {
  WaveformAmplitudeLimits,
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
  resolveRenderedYAxisSeriesGroups,
  resolveYAxisTicks,
  resolveYAxisTickCount,
  type YAxisSlot,
} from './layout'
import type { DisplayTrack, TrackLayout, WaveformYAxisLayout } from './types'
import { applyXDomainStrategy } from './xDomain'
import { alignLeftYAxisTitles } from './yAxisTitleLayout'
import { resolveYAxisSpaceBudget } from './yAxisSpaceBudget'
import {
  alignIntegerZoomDomain,
  normalizeIntegerZoomDomain,
  integerZoomTicks,
} from '../interaction/integerZoom'

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
  effectiveXDomains?: Record<string, [number, number]>
  initialXDomain?: [number, number]
  initialXDomains?: Record<string, [number, number]>
  xDomainStrategy?: WaveformXDomainStrategy
  integerZoom?: boolean
  amplitudeLimits?: WaveformAmplitudeLimits
  fixedYDomain?: [number, number]
  fixedYDomains?: Record<string, [number, number]>
  yDomains?: Record<string, [number, number]>
  timeUnit: 's' | 'ms'
  xAxisLabelFormatter?: WaveformXAxisLabelFormatter
  xAxisSplitNumber?: number
  yAxisSplitNumber?: number
  yAxisNice?: boolean
  yAxisPadding?: YAxisPaddingOptions
  yAxisUpperPaddingRatio?: number
  rendering: ResolvedWaveformRenderingOptions
  /** Latest sampling result for SVG lines only; source series remain complete for interaction. */
  linePointOverrides?: Readonly<Record<string, WaveformPoint[]>>
  /** Sampling preparation needs domains and dimensions, without materializing SVG geometry. */
  includeGeometry?: boolean
  hideSecondaryLabels: boolean
  yAxisLabelX: number
  yLabel?: string
  yAxisSlots?: readonly YAxisSlot[]
  showEmptyTracks: boolean
  useNonEmptyBottomTracks?: boolean
  compactYAxisLayout?: boolean
  measureTextWidth?: (text: string) => number
  showAxisUnits?: boolean
  domainTimeUnit?: 's' | 'ms'
}

function resolveIndependentXDomain(
  track: DisplayTrack,
  seriesId: string,
  options: BuildTrackLayoutsOptions,
): [number, number] {
  if (options.effectiveXDomains?.[track.id]) return options.effectiveXDomains[track.id]
  const strategy = options.xDomainStrategy ?? { type: 'data' }
  const explicitDomain =
    options.initialXDomains?.[track.id] ??
    options.initialXDomains?.[seriesId] ??
    options.initialXDomain
  return alignIntegerZoomDomain(
    explicitDomain
      ? applyXDomainStrategy(explicitDomain, strategy, true)
      : applyXDomainStrategy(track.xDomain, strategy),
    { integerZoom: options.integerZoom, timeUnit: options.domainTimeUnit ?? options.timeUnit },
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
    if (!cell.series && !options.showEmptyTracks) return []
    const displayTrack: DisplayTrack = cell.series ?? {
      id: `empty-grid-slot-${cell.slotIndex}`,
      series: [],
      visibleSeries: [],
      xDomain: options.initialXDomain ?? options.sharedZoomDomain,
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
      options.yAxisPadding ?? options.yAxisUpperPaddingRatio,
      options.amplitudeLimits,
    )
    const sideIndexes = { left: 0, right: 0 }
    const sideOffsets = { left: 0, right: 0 }
    const yAxes: WaveformYAxisLayout[] = yAxisGroups.map((group) => {
      const sideIndex = sideIndexes[group.side]++
      const tickCount = resolveYAxisTickCount(cell.plotHeight, options.yAxisSplitNumber)
      const resolvedTicks = resolveYAxisTicks(
        group.domain,
        tickCount,
        options.yAxisNice !== false,
        group.tickBounds,
      )
      const scale = scaleLinear(resolvedTicks.domain, [cell.plotHeight, 0])
      const majorTicks = resolvedTicks.values
      const maximumTick =
        group.maximumTick !== undefined &&
        group.maximumTick >= resolvedTicks.domain[0] &&
        group.maximumTick <= resolvedTicks.domain[1]
          ? group.maximumTick
          : undefined
      const minimumTick =
        group.minimumTick !== undefined &&
        group.minimumTick >= resolvedTicks.domain[0] &&
        group.minimumTick <= resolvedTicks.domain[1]
          ? group.minimumTick
          : undefined
      const tickValues = resolveYAxisTickValues(
        majorTicks,
        maximumTick,
        minimumTick,
        group.amplitudeLimit,
      )
      const budget = resolveYAxisSpaceBudget({
        unit: options.showAxisUnits !== false ? group.seriesList[0]?.unit : undefined,
        labelTextStyle: options.yAxisPadding?.labelTextStyle,
      })
      const slot = options.yAxisSlots?.find(
        (candidate) => candidate.side === group.side && candidate.sideIndex === sideIndex,
      )
      const x = slot
        ? (group.side === 'left' ? 0 : cell.width) + slot.axisOffset
        : group.side === 'left'
          ? -sideOffsets.left
          : cell.width + sideOffsets.right
      const labelX = slot
        ? (group.side === 'left' ? 0 : cell.width) + slot.labelOffset
        : x + (group.side === 'left' ? -budget.titleDistance : budget.titleDistance)
      if (!slot) sideOffsets[group.side] += budget.clearance
      return {
        index: group.index,
        side: group.side,
        x,
        labelX,
        scale,
        maximumTick,
        minimumTick,
        amplitudeLimit: group.amplitudeLimit,
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
      options.xAxisSplitNumber ?? 5,
      options,
    )
    const xAxisLabelFormatter = options.xAxisLabelFormatter
    const yMajorTicks =
      yAxes[0]?.majorTicks ??
      (isEmpty
        ? fallbackYScale.ticks(resolveYAxisTickCount(cell.plotHeight, options.yAxisSplitNumber))
        : [])
    const yAxisTickValues = yAxes[0]?.tickValues ?? []
    const domain = xScale.domain() as [number, number]
    const endpointLabels = {
      start: formatXAxisLabel(domain[0], domain, options.timeUnit, 'start', xAxisLabelFormatter),
      end: formatXAxisLabel(domain[1], domain, options.timeUnit, 'end', xAxisLabelFormatter),
    }
    const xAxisTickValues = xMajorTicks
    const seriesPaths = displayTrack.visibleSeries.map((trackSeries) => {
      const yAxis = yAxes.find((axis) =>
        axis.seriesList.some((series) => series.id === trackSeries.id),
      )
      const seriesYScale = yAxis?.scale ?? yScale
      const renderPoints =
        options.includeGeometry === false
          ? { linePoints: [], pointRenderPoints: [], errorBarRenderPoints: [] }
          : selectSeriesRenderSourcePoints(
              trackSeries.source ?? pointSourceFromPoints(trackSeries.points),
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
      return {
        series: trackSeries,
        path:
          options.includeGeometry === false
            ? null
            : generateWaveformPath(
                renderPoints.linePoints,
                trackSeries.lineType,
                xScale,
                seriesYScale,
              ),
        lineRenderPoints: renderPoints.linePoints,
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
      yMinorTicks: yAxes[0]?.minorTicks ?? (isEmpty ? buildMinorTicks(yMajorTicks, 2) : []),
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

  // Supplied slots already share their numeric budget and include chart-edge padding.
  if (!options.yAxisSlots) {
    alignLeftYAxisTitles(layouts, options.yLabel, {
      labelTextStyle: options.yAxisPadding?.labelTextStyle,
      showUnits: options.showAxisUnits,
      compact: options.compactYAxisLayout,
    })
  }
  return layouts
}

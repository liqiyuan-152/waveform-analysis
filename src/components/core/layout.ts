import { line, scaleLinear, zoomIdentity, type ZoomTransform } from 'd3'

import { selectRenderablePoints, type ResolvedWaveformRenderingOptions } from '../../core'
import type { WaveformDisplayMode, WaveformOverlayMode, WaveformPoint } from '../../types'
import {
  buildMinorTicks,
  formatAxisTimeExponent,
  formatEndpointTime,
  formatScientificAxisExponent,
  formatScientificAxisLabel,
  paddedDomain,
} from '../../utils'
import {
  getBottomRowCellIndexes,
  type GridCellGeometry,
  type NormalizedWaveformGridOptions,
} from './grid'
import type { DisplaySeries, DisplayTrack, TrackLayout, WaveformYAxisLayout } from './types'

export const MAX_MULTI_Y_AXIS_COUNT = 4
const Y_AXIS_CHARACTER_WIDTH = 7
const Y_AXIS_TICK_PADDING = 7
const Y_AXIS_OUTER_PADDING = 4
const Y_AXIS_LABEL_GAP = 6
const Y_AXIS_LABEL_BAND_WIDTH = 24
const Y_AXIS_EXPONENT_GAP = 4

interface YAxisSeriesGroup {
  index: number
  side: 'left' | 'right'
  seriesList: DisplaySeries[]
  domain: [number, number]
}

function resolveAxisSides(axisCount: number): Array<'left' | 'right'> {
  if (axisCount >= 4) return ['left', 'left', 'right', 'right']
  if (axisCount === 3) return ['left', 'right', 'right']
  if (axisCount === 2) return ['left', 'right']
  return ['left']
}

// 缓存 axis groups 计算结果，避免重复计算
const yAxisGroupsCache = new WeakMap<DisplayTrack, Map<WaveformOverlayMode, YAxisSeriesGroup[]>>()

export function buildYAxisSeriesGroups(
  track: DisplayTrack,
  overlayMode: WaveformOverlayMode,
): YAxisSeriesGroup[] {
  // 检查缓存
  let trackCache = yAxisGroupsCache.get(track)
  if (!trackCache) {
    trackCache = new Map()
    yAxisGroupsCache.set(track, trackCache)
  }

  const cached = trackCache.get(overlayMode)
  if (cached) return cached
  const axisCount =
    overlayMode === 'multi-axis'
      ? Math.min(track.series.length, MAX_MULTI_Y_AXIS_COUNT)
      : Math.min(track.series.length, 1)
  const sides = resolveAxisSides(axisCount)
  const grouped = Array.from({ length: axisCount }, (_, index) => ({
    index,
    side: sides[index],
    seriesList: [] as DisplaySeries[],
    domain: [0, 1] as [number, number],
  }))

  track.series.forEach((series, index) => {
    grouped[Math.min(index, axisCount - 1)]?.seriesList.push(series)
  })
  grouped.forEach((group) => {
    if (overlayMode === 'single-axis') {
      group.domain = track.yDomain
    } else {
      const yDomainValues = group.seriesList.flatMap((series) => series.yDomain)
      group.domain = yDomainValues.length > 0 ? paddedDomain(yDomainValues) : track.yDomain
    }
  })

  // 缓存结果
  trackCache.set(overlayMode, grouped)
  return grouped
}

function axisTextMetrics(domain: [number, number]): {
  exponentLabel: string | null
  exponentWidth: number
  tickTextWidth: number
} {
  const scale = scaleLinear(domain, [1, 0]).nice()
  const [axisMin, axisMax] = scale.domain()
  const values = scale.ticks(10)
  const maximumTickCharacters = Math.max(
    1,
    ...values.map((value) => formatScientificAxisLabel(value, { axisMin, axisMax }).length),
  )
  const exponentLabel = formatScientificAxisExponent(axisMin, axisMax)
  return {
    exponentLabel,
    exponentWidth: exponentLabel ? exponentLabel.length * Y_AXIS_CHARACTER_WIDTH : 0,
    tickTextWidth: maximumTickCharacters * Y_AXIS_CHARACTER_WIDTH,
  }
}

function axisExponentClearance(domain: [number, number]): number {
  const { exponentLabel, exponentWidth } = axisTextMetrics(domain)
  return exponentLabel ? exponentWidth + Y_AXIS_EXPONENT_GAP : 0
}

export function measureYAxisGroupClearance(group: YAxisSeriesGroup): number {
  return (
    axisTextMetrics(group.domain).tickTextWidth +
    axisExponentClearance(group.domain) +
    Y_AXIS_TICK_PADDING +
    Y_AXIS_LABEL_GAP +
    Y_AXIS_LABEL_BAND_WIDTH +
    Y_AXIS_OUTER_PADDING
  )
}

function measureYAxisGroupTickClearance(group: YAxisSeriesGroup): number {
  return (
    axisTextMetrics(group.domain).tickTextWidth +
    axisExponentClearance(group.domain) +
    Y_AXIS_TICK_PADDING +
    Y_AXIS_OUTER_PADDING
  )
}

export function measureTrackYAxisClearance(
  track: DisplayTrack,
  overlayMode: WaveformOverlayMode,
): { left: number; right: number } {
  return buildYAxisSeriesGroups(track, overlayMode).reduce(
    (clearance, group) => {
      clearance[group.side] +=
        overlayMode === 'multi-axis' || track.series.length === 1
          ? measureYAxisGroupClearance(group)
          : measureYAxisGroupTickClearance(group)
      return clearance
    },
    { left: 0, right: 0 },
  )
}

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
    const yAxisGroups = buildYAxisSeriesGroups(displayTrack, options.overlayMode)
    const sideOffsets = { left: 0, right: 0 }
    const yAxes: WaveformYAxisLayout[] = yAxisGroups.map((group) => {
      const scale = scaleLinear(group.domain, [cell.plotHeight, 0]).nice()
      const majorTicks = scale.ticks(Math.max(2, Math.floor(cell.plotHeight / 55)))
      const [axisStart, axisEnd] = scale.domain()
      const showAxisEnd = options.displayMode !== 'compact' || cell.row === 0
      const visibleMajorTicks = showAxisEnd
        ? majorTicks
        : majorTicks.filter((tick) => tick !== axisEnd)
      const tickValues = Array.from(
        new Set([axisStart, ...visibleMajorTicks, ...(showAxisEnd ? [axisEnd] : [])]),
      )
      const { exponentLabel, exponentWidth, tickTextWidth } = axisTextMetrics(group.domain)
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
          ? -(Y_AXIS_TICK_PADDING + tickTextWidth + exponentClearance)
          : Y_AXIS_TICK_PADDING + tickTextWidth + exponentClearance)
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
    const seriesPaths = displayTrack.series.map((trackSeries) => {
      const yAxis = yAxes.find((axis) =>
        axis.seriesList.some((series) => series.id === trackSeries.id),
      )
      const seriesYScale = yAxis?.scale ?? yScale
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
              .y((point) => seriesYScale(point.y))(renderPoints),
        yScale: seriesYScale,
        yAxisIndex: yAxis?.index ?? 0,
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
      showXAxis:
        options.displayMode === 'independent' ||
        (options.displayMode === 'compact'
          ? cell.row === options.grid.rowCount - 1
          : bottomCells.has(cell.slotIndex)),
    }
  })
}

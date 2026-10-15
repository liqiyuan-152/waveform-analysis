import { channelColors, margin } from '../components/core/constants'
import {
  getPageCount,
  normalizeGridOptions,
  paginateSeries,
  resolveGridCellGeometry,
} from '../components/core/grid'
import { buildTrackLayouts } from '../components/core/trackLayoutBuilder'
import { resolvePageableTracks } from '../components/core/trackPagination'
import type { DisplaySeries, DisplayTrack, TrackLayout } from '../components/core/types'
import { applyXDomainStrategy } from '../components/core/xDomain'
import { alignIntegerZoomDomain } from '../components/interaction/integerZoom'
import { resolveWaveformRenderingOptions } from '../core/renderingOptions'
import type { ChartModel } from '../model/ChartModel'
import { paddedDomain } from '../utils/domain'
import { AxisLayoutEngine } from './AxisLayoutEngine'
import type { WaveformPoint } from '../types/chart'
import { YAxisTextMeasurer } from './YAxisTextMeasurer'
import { resolveCompactPaginationBand } from '../components/core/pagination'

export interface ChartLayoutSnapshot {
  geometryReady: boolean
  width: number
  height: number
  drawingHeight: number
  titleHeight: number
  paginationVisible: boolean
  paginationBandHeight: number
  left: number
  top: number
  innerWidth: number
  innerHeight: number
  pageCount: number
  page: number
  tracks: DisplayTrack[]
  trackLayouts: TrackLayout[]
  sharedDomain: [number, number]
  originalDomains: Record<string, [number, number]>
}

export class ChartLayoutEngine {
  private readonly axes: AxisLayoutEngine
  private readonly text: YAxisTextMeasurer
  private readonly domainTimeUnit: 's' | 'ms'

  constructor(
    private readonly model: ChartModel,
    ownerDocument?: Document,
  ) {
    this.domainTimeUnit = model.options.value.timeUnit
    this.text = new YAxisTextMeasurer(ownerDocument)
    this.axes = new AxisLayoutEngine(this.text.measure)
  }

  calculate(
    width: number,
    height: number,
    titleHeight = 0,
    linePointOverrides?: Readonly<Record<string, WaveformPoint[]>>,
    includeGeometry = true,
  ): ChartLayoutSnapshot {
    const options = this.model.options.value
    const hidden = this.model.visibility.snapshot(options.hiddenSeriesIds)
    const series: DisplaySeries[] = this.model.data.series.map((item, index) => ({
      ...item,
      color:
        item.color ??
        (index === 0 ? options.lineColor : channelColors[index % channelColors.length]!),
    }))
    const grid = normalizeGridOptions(options.grid)
    const grouped = new Map<string, DisplaySeries[]>()
    for (const item of series) {
      const id = item.trackId || item.id
      const group = grouped.get(id) ?? []
      group.push(item)
      grouped.set(id, group)
    }
    const order = grid.trackOrder ?? []
    const trackIds = [...order, ...Array.from(grouped.keys()).filter((id) => !order.includes(id))]
    const tracks: DisplayTrack[] = trackIds.map((id) => {
      const items = grouped.get(id) ?? []
      const visible = items.filter((item) => !hidden.has(item.id))
      const domainSeries = visible.length ? visible : items
      return {
        id,
        series: items,
        visibleSeries: visible,
        xDomain: domainSeries.length
          ? paddedDomain(domainSeries.flatMap((item) => item.xDomain))
          : [0, 1],
        yDomain: domainSeries.length
          ? paddedDomain(domainSeries.flatMap((item) => item.yDomain))
          : [0, 1],
      }
    })
    const pageable = resolvePageableTracks(tracks, grid.hideEmptyTracks)
    const pageCount = getPageCount(pageable.length, grid)
    this.model.presentation.setPage(this.model.presentation.page, pageCount)
    const pageTracks = paginateSeries(pageable, this.model.presentation.page, grid)
    const withSeries = pageTracks.filter((track) => track.series.length > 0)
    const layoutTracks = grid.fillIncompleteLastRow && withSeries.length ? withSeries : pageTracks
    const active = tracks.some((track) => track.visibleSeries.length)
      ? tracks.filter((track) => track.visibleSeries.length)
      : tracks.filter((track) => track.series.length)
    const rawShared = paddedDomain(active.flatMap((track) => track.xDomain))
    const normalizeOriginal = (raw: [number, number], configured?: [number, number]) => {
      const explicit = configured && configured[0] !== configured[1]
      const input: [number, number] = explicit
        ? [Math.min(...configured), Math.max(...configured)]
        : raw
      return alignIntegerZoomDomain(
        applyXDomainStrategy(input, options.xDomainStrategy, !!explicit),
        {
          integerZoom: options.integerZoom,
          timeUnit: this.domainTimeUnit,
        },
      )
    }
    const sharedDomain = normalizeOriginal(rawShared, options.initialXDomain)
    const originalDomains = Object.fromEntries(
      tracks.map((track) => [
        track.id,
        normalizeOriginal(
          track.xDomain,
          options.initialXDomains?.[track.id] ??
            options.initialXDomains?.[track.series[0]?.id ?? track.id] ??
            options.initialXDomain,
        ),
      ]),
    )
    // An independent consumer may legitimately name a track "shared".
    if (options.displayMode !== 'independent' || !originalDomains.shared)
      originalDomains.shared = sharedDomain
    const independent = options.displayMode === 'independent'
    const yDomains: Record<string, [number, number]> = {}
    for (const track of tracks)
      Object.assign(
        yDomains,
        this.model.viewport.get(independent ? track.id : 'shared')?.yDomains ?? {},
      )
    const top =
      Number.isFinite(options.plotMargin.top) && options.plotMargin.top! >= 0
        ? options.plotMargin.top!
        : margin.top
    const bottomMargin =
      Number.isFinite(options.plotMargin.bottom) && options.plotMargin.bottom! >= 0
        ? options.plotMargin.bottom!
        : margin.bottom
    const bottom = Math.max(options.layoutPreset === 'edge-compact' ? 44 : 0, bottomMargin)
    const paginationVisible = grid.showPagination && pageCount > 1 && !options.cleanView
    const paginationBandHeight =
      options.layoutPreset === 'edge-compact'
        ? resolveCompactPaginationBand(paginationVisible)
        : grid.showPagination && pageCount > 1 && width <= 520
          ? 40
          : 0
    const drawingHeight = Math.max(0, height - titleHeight - paginationBandHeight)
    const innerHeight = Math.max(0, drawingHeight - top - bottom)
    const axis = this.axes.calculate(
      options,
      tracks,
      layoutTracks,
      grid,
      width,
      innerHeight,
      yDomains,
    )
    const cells = resolveGridCellGeometry(
      axis.innerWidth,
      innerHeight,
      grid,
      options.displayMode,
      layoutTracks.map((track) =>
        options.layoutPreset === 'edge-compact' ? !!track.series.length : true,
      ),
      axis.horizontalGap,
      true,
      options.layoutPreset === 'edge-compact' && !options.cleanView,
    ).map((cell, index) => ({ ...cell, series: layoutTracks[index] }))
    const effectiveXDomains = Object.fromEntries(
      tracks.flatMap((track) => {
        const state = this.model.viewport.get(track.id)
        return state ? [[track.id, state.xDomain]] : []
      }),
    )
    const trackLayouts =
      axis.innerWidth > 0 && innerHeight > 0
        ? buildTrackLayouts({
            cells,
            grid,
            displayMode: options.displayMode,
            overlayMode: options.overlayMode,
            independentTransforms: [],
            effectiveXDomains,
            sharedZoomDomain: this.model.viewport.get('shared')?.xDomain ?? sharedDomain,
            initialXDomain: options.initialXDomain,
            initialXDomains: options.initialXDomains,
            xDomainStrategy: options.xDomainStrategy,
            integerZoom: options.integerZoom,
            amplitudeLimits: options.amplitudeLimits,
            fixedYDomain: options.yDomain,
            fixedYDomains: options.yDomains,
            yDomains,
            timeUnit: options.timeUnit,
            domainTimeUnit: this.domainTimeUnit,
            xAxisLabelFormatter: options.axes?.x?.labelFormatter,
            yAxisSplitNumber: options.axes?.y?.splitNumber,
            yAxisNice: options.axes?.y?.nice,
            yAxisPadding: options.axes?.y,
            rendering: resolveWaveformRenderingOptions(options.rendering),
            linePointOverrides,
            includeGeometry,
            hideSecondaryLabels: options.cleanView || axis.hideSecondaryLabels,
            yLabel: options.yLabel,
            yAxisLabelX: axis.labelX,
            yAxisSlots: axis.slots,
            showEmptyTracks: series.length > 0,
            useNonEmptyBottomTracks: options.layoutPreset === 'edge-compact',
            compactYAxisLayout: options.layoutPreset === 'edge-compact',
            measureTextWidth: this.text.measure,
            showAxisUnits: axis.showUnits,
          })
        : []
    return {
      geometryReady: includeGeometry,
      width,
      height,
      drawingHeight,
      titleHeight,
      paginationVisible,
      paginationBandHeight,
      left: axis.left,
      top,
      innerWidth: axis.innerWidth,
      innerHeight,
      pageCount,
      page: this.model.presentation.page,
      tracks,
      trackLayouts,
      sharedDomain,
      originalDomains,
    }
  }
}

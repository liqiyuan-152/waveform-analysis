import { scaleLinear, type ZoomTransform } from 'd3'
import { computed, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import { resolveWaveformRenderingOptions } from '../../core'
import { paddedDomain } from '../../utils'
import {
  layoutAnnotations,
  type AnnotationSeriesInfo,
  type AnnotationTrackLayout,
} from '../annotation'
import { channelColors } from './constants'
import { getPageCount, normalizeGridOptions, paginateSeries, resolveGridCellGeometry } from './grid'
import { buildTrackLayouts, resolveYAxisTickCount } from './layout'
import type { DisplaySeries, DisplayTrack, TrackLayout } from './types'
import { createFrameNumberResolver, resolvePageableTracks } from './trackPagination'
import type { PreparedWaveformSeries } from './useWaveformData'
import type { ResolvedWaveformChartProps } from './waveformChartTypes'
import { applyXDomainStrategy } from './xDomain'
import { alignIntegerZoomDomain, normalizeIntegerZoomDomain } from '../interaction/integerZoom'
import { resolveViewportYDomains } from './yAxisLayoutMetrics'
import { useWaveformYAxisLayout } from './useWaveformYAxisLayout'
import type { useWaveformAnnotationInteraction } from '../annotation'
interface LayoutContext {
  props: ResolvedWaveformChartProps
  preparedSeries: ShallowRef<PreparedWaveformSeries[]>
  currentPage: Ref<number>
  hiddenSeriesIdSet: ComputedRef<Set<string>>
  chartWidth: ComputedRef<number>
  innerHeight: ComputedRef<number>
  isCleanView: ComputedRef<boolean>
  sharedTransform: ShallowRef<ZoomTransform>
  independentTransforms: ShallowRef<ZoomTransform[]>
  sharedYDomains: Ref<Record<string, [number, number]>>
  independentYDomains: Ref<Record<number, [number, number]>>
  annotationInteraction: ReturnType<typeof useWaveformAnnotationInteraction>
  linePointOverrides?: ShallowRef<Readonly<Record<string, import('../../types').WaveformPoint[]>>>
}
export function useWaveformLayout(context: LayoutContext) {
  const {
    props,
    preparedSeries,
    currentPage,
    hiddenSeriesIdSet,
    chartWidth,
    innerHeight,
    isCleanView,
    sharedTransform,
    independentTransforms,
    sharedYDomains,
    independentYDomains,
    annotationInteraction,
    linePointOverrides,
  } = context
  const chartSeries = computed<DisplaySeries[]>(() =>
    preparedSeries.value.map((series, index): DisplaySeries => ({
      ...series,
      color:
        series.color ??
        (index === 0 ? props.lineColor : channelColors[index % channelColors.length]),
    })),
  )
  const gridOptions = computed(() => normalizeGridOptions(props.grid))
  const chartTracks = computed<DisplayTrack[]>(() => {
    const groupedSeries = new Map<string, DisplaySeries[]>()
    chartSeries.value.forEach((series) => {
      const trackId = series.trackId || series.id
      const trackSeries = groupedSeries.get(trackId)
      if (trackSeries) trackSeries.push(series)
      else groupedSeries.set(trackId, [series])
    })
    const trackOrder = gridOptions.value.trackOrder ?? []
    const orderedTrackIds = [
      ...trackOrder,
      ...Array.from(groupedSeries.keys()).filter((trackId) => !trackOrder.includes(trackId)),
    ]
    return orderedTrackIds.map((id) => {
      const series = groupedSeries.get(id) ?? []
      const visibleSeries = series.filter((item) => !hiddenSeriesIdSet.value.has(item.id))
      const xDomainValues: number[] = []
      const yDomainValues: number[] = []
      const domainSeries = visibleSeries.length ? visibleSeries : series
      domainSeries.forEach((item) => {
        xDomainValues.push(item.xDomain[0], item.xDomain[1])
        yDomainValues.push(item.yDomain[0], item.yDomain[1])
      })
      return {
        id,
        series,
        visibleSeries,
        xDomain: xDomainValues.length ? paddedDomain(xDomainValues) : [0, 1],
        yDomain: yDomainValues.length ? paddedDomain(yDomainValues) : [0, 1],
      }
    })
  })
  const showLegendUnits = computed(
    () =>
      props.unitDisplayMode === 'channel-label-or-legend' ||
      (props.unitDisplayMode === 'legend-single-series' &&
        !chartTracks.value.some((track) => track.series.length > 1)),
  )
  const renderingOptions = computed(() => resolveWaveformRenderingOptions(props.rendering))
  const pageableTracks = computed(() =>
    resolvePageableTracks(chartTracks.value, gridOptions.value.hideEmptyTracks),
  )
  const pageCount = computed(() => getPageCount(pageableTracks.value.length, gridOptions.value))
  const pagedTracks = computed(() =>
    paginateSeries(pageableTracks.value, currentPage.value, gridOptions.value),
  )
  const hideYAxisTitles = computed(
    () =>
      props.unitDisplayMode === 'channel-label-or-legend' &&
      pagedTracks.value.some((track) => track.series.length > 1),
  )
  const layoutTracks = computed(() => {
    const tracksWithSeries = pagedTracks.value.filter((track) => track.series.length > 0)
    return gridOptions.value.fillIncompleteLastRow && tracksWithSeries.length > 0
      ? tracksWithSeries
      : pagedTracks.value
  })
  const yAxisTickCount = computed(() =>
    resolveYAxisTickCount(innerHeight.value, props.axes?.y?.splitNumber),
  )
  const viewportYDomains = computed(() =>
    resolveViewportYDomains(
      props.displayMode,
      chartTracks.value,
      sharedYDomains.value,
      independentYDomains.value,
    ),
  )
  const {
    yAxisMetrics,
    yAxisSlots,
    resolvedChartLeftMargin,
    innerWidth,
    yAxisLayout,
    hasVisibleWaveformData,
  } = useWaveformYAxisLayout({
    props,
    chartTracks,
    layoutTracks,
    chartWidth,
    gridOptions,
    viewportYDomains,
    yAxisTickCount,
  })
  const hasWaveformData = computed(() => chartSeries.value.length > 0)
  const hasChartArea = computed(() => innerWidth.value > 0 && innerHeight.value > 0)
  const resolvedXLabel = computed(() => props.xLabel ?? `时间（${props.timeUnit}）`)
  const activeInteractionMode = computed(() => props.interactionMode)
  const isZoomMode = computed(() => activeInteractionMode.value !== 'annotation')
  const sharedXDomain = computed(() => {
    const values: number[] = []
    const tracks = chartTracks.value.some((track) => track.visibleSeries.length)
      ? chartTracks.value.filter((track) => track.visibleSeries.length)
      : chartTracks.value.filter((track) => track.series.length)
    tracks.forEach((track) => {
      values.push(track.xDomain[0], track.xDomain[1])
    })
    return paddedDomain(values)
  })
  const initialXDomain = computed<[number, number]>(() => {
    const domain = props.initialXDomain
    if (
      domain &&
      Number.isFinite(domain[0]) &&
      Number.isFinite(domain[1]) &&
      domain[0] !== domain[1]
    ) {
      return alignIntegerZoomDomain(
        applyXDomainStrategy(
          domain[0] < domain[1] ? domain : [domain[1], domain[0]],
          props.xDomainStrategy,
          true,
        ),
        props,
      )
    }
    return alignIntegerZoomDomain(
      applyXDomainStrategy(sharedXDomain.value, props.xDomainStrategy),
      props,
    )
  })
  const resolveInitialTrackDomain = (track: TrackLayout): [number, number] => {
    const configuredDomain =
      props.initialXDomains?.[track.series?.trackId ?? track.series?.id ?? track.id] ??
      (track.series ? props.initialXDomains?.[track.series.id] : undefined) ??
      props.initialXDomain
    if (
      configuredDomain &&
      Number.isFinite(configuredDomain[0]) &&
      Number.isFinite(configuredDomain[1]) &&
      configuredDomain[0] !== configuredDomain[1]
    ) {
      return alignIntegerZoomDomain(
        applyXDomainStrategy(
          configuredDomain[0] < configuredDomain[1]
            ? configuredDomain
            : [configuredDomain[1], configuredDomain[0]],
          props.xDomainStrategy,
          true,
        ),
        props,
      )
    }
    return alignIntegerZoomDomain(
      applyXDomainStrategy(
        paddedDomain(track.seriesList.flatMap((series) => series.xDomain)),
        props.xDomainStrategy,
      ),
      props,
    )
  }
  const sharedZoomDomain = computed(() =>
    normalizeIntegerZoomDomain(
      sharedTransform.value
        .rescaleX(scaleLinear(initialXDomain.value, [0, innerWidth.value]))
        .domain() as [number, number],
      props,
    ),
  )
  const gridCells = computed(() => {
    const cells = resolveGridCellGeometry(
      innerWidth.value,
      innerHeight.value,
      gridOptions.value,
      props.displayMode,
      layoutTracks.value.map((track) =>
        props.layoutPreset === 'edge-compact' ? track.series.length > 0 : Boolean(track),
      ),
      yAxisLayout.value.horizontalGap,
      true,
      props.layoutPreset === 'edge-compact' && !isCleanView.value,
    )
    return cells.map((cell, index) => ({ ...cell, series: layoutTracks.value[index] }))
  })
  const trackLayouts = computed<TrackLayout[]>(() =>
    buildTrackLayouts({
      cells: gridCells.value,
      grid: gridOptions.value,
      useNonEmptyBottomTracks: props.layoutPreset === 'edge-compact',
      compactYAxisLayout: props.layoutPreset === 'edge-compact',
      showAxisUnits:
        props.unitDisplayMode !== 'channel-label-or-legend' &&
        (props.layoutPreset !== 'edge-compact' || props.unitDisplayMode === 'axis'),
      displayMode: props.displayMode,
      overlayMode: props.overlayMode,
      independentTransforms: independentTransforms.value,
      sharedZoomDomain: sharedZoomDomain.value,
      initialXDomain: props.initialXDomain ? initialXDomain.value : undefined,
      initialXDomains: props.initialXDomains,
      xDomainStrategy: props.xDomainStrategy,
      integerZoom: props.integerZoom,
      fixedYDomain: props.yDomain,
      fixedYDomains: props.yDomains,
      yDomains: viewportYDomains.value,
      timeUnit: props.timeUnit,
      xAxisLabelFormatter: props.axes?.x?.labelFormatter,
      yAxisSplitNumber: props.axes?.y?.splitNumber,
      yAxisNice: props.axes?.y?.nice,
      yAxisUpperPaddingRatio: props.axes?.y?.upperPaddingRatio,
      rendering: renderingOptions.value,
      linePointOverrides: linePointOverrides?.value,
      hideSecondaryLabels: isCleanView.value || yAxisLayout.value.hideSecondaryLabels,
      yLabel: props.yLabel,
      yAxisLabelX:
        yAxisSlots.value.slots.find((slot) => slot.side === 'left' && slot.sideIndex === 0)
          ?.labelOffset ?? yAxisMetrics.value.labelCenterX,
      yAxisSlots: yAxisSlots.value.slots,
      showCompactEmptyTracks: props.displayMode === 'compact' && hasWaveformData.value,
    }),
  )
  const annotationLayoutsForTrack = (track: TrackLayout): AnnotationTrackLayout[] =>
    track.seriesList.map((series) => ({
      ...track,
      series,
      yScale:
        track.seriesPaths.find((seriesPath) => seriesPath.series.id === series.id)?.yScale ??
        track.yScale,
    }))
  const resolveSeriesYScale = (track: TrackLayout, seriesId: string) =>
    track.seriesPaths.find((seriesPath) => seriesPath.series.id === seriesId)?.yScale ??
    track.yScale
  const annotationTrackLayouts = computed<AnnotationTrackLayout[]>(() =>
    trackLayouts.value.flatMap(annotationLayoutsForTrack),
  )
  const renderedAnnotations = computed(() =>
    props.annotationsVisible
      ? layoutAnnotations(
          props.annotations,
          annotationTrackLayouts.value,
          innerWidth.value,
          innerHeight.value,
        )
      : [],
  )
  const editorSeries = computed<AnnotationSeriesInfo | undefined>(() => {
    const seriesId = annotationInteraction.editorDraft.value?.annotation.seriesId
    const series = chartSeries.value.find((item) => item.id === seriesId)
    return series
      ? {
          id: series.id,
          name: series.name.trim() || series.id,
          color: series.color,
          unit: series.unit,
        }
      : undefined
  })
  const resolveFrameNumber = createFrameNumberResolver(
    () => props.frameNumber,
    () => props.frameNumbers,
    () => chartTracks.value,
  )
  return {
    chartSeries,
    chartTracks,
    showLegendUnits,
    hideYAxisTitles,
    pageableTracks,
    renderingOptions,
    gridOptions,
    pageCount,
    pagedTracks,
    resolvedChartLeftMargin,
    innerWidth,
    hasVisibleWaveformData,
    hasWaveformData,
    hasChartArea,
    resolvedXLabel,
    activeInteractionMode,
    isZoomMode,
    initialXDomain,
    sharedZoomDomain,
    resolveInitialTrackDomain,
    gridCells,
    trackLayouts,
    annotationLayoutsForTrack,
    resolveSeriesYScale,
    annotationTrackLayouts,
    renderedAnnotations,
    editorSeries,
    resolveFrameNumber,
  }
}

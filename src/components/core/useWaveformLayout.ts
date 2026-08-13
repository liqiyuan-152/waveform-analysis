import { scaleLinear, type ZoomTransform } from 'd3'
import { computed, type ComputedRef, type Ref, type ShallowRef } from 'vue'

import { resolveWaveformRenderingOptions } from '../../core'
import { paddedDomain } from '../../utils'
import {
  layoutAnnotations,
  type AnnotationSeriesInfo,
  type AnnotationTrackLayout,
} from '../annotation'
import {
  channelColors,
  margin,
  MINIMUM_PLOT_WIDTH,
  Y_AXIS_CHARACTER_WIDTH,
  Y_AXIS_LABEL_BAND_WIDTH,
  Y_AXIS_LABEL_GAP,
  Y_AXIS_OUTER_PADDING,
  Y_AXIS_TICK_PADDING,
} from './constants'
import {
  getGridGap,
  getPageCount,
  normalizeGridOptions,
  paginateSeries,
  resolveGridCellGeometry,
} from './grid'
import {
  buildTrackLayouts,
  axisTextMetrics,
  measureTrackYAxisClearance,
  resolveYAxisSeriesGroups,
} from './layout'
import type { DisplaySeries, DisplayTrack, TrackLayout } from './types'
import type { PreparedWaveformSeries } from './useWaveformData'
import type { ResolvedWaveformChartProps } from './waveformChartTypes'
import { applyXDomainStrategy } from './xDomain'
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
  } = context
  const chartSeries = computed<DisplaySeries[]>(() =>
    preparedSeries.value.map((series, index): DisplaySeries => ({
      ...series,
      color:
        series.color ??
        (index === 0 ? props.lineColor : channelColors[index % channelColors.length]),
    })),
  )
  const chartTracks = computed<DisplayTrack[]>(() => {
    const groupedSeries = new Map<string, DisplaySeries[]>()
    chartSeries.value.forEach((series) => {
      const trackId = series.trackId || series.id
      const trackSeries = groupedSeries.get(trackId)
      if (trackSeries) trackSeries.push(series)
      else groupedSeries.set(trackId, [series])
    })
    return Array.from(groupedSeries, ([id, series]) => {
      const visibleSeries = series.filter((item) => !hiddenSeriesIdSet.value.has(item.id))
      const xDomainValues: number[] = []
      const yDomainValues: number[] = []
      visibleSeries.forEach((item) => {
        xDomainValues.push(item.xDomain[0], item.xDomain[1])
        yDomainValues.push(item.yDomain[0], item.yDomain[1])
      })
      return {
        id,
        series,
        visibleSeries,
        xDomain: paddedDomain(xDomainValues),
        yDomain: paddedDomain(yDomainValues),
      }
    })
  })
  const gridOptions = computed(() => normalizeGridOptions(props.grid))
  const renderingOptions = computed(() => resolveWaveformRenderingOptions(props.rendering))
  const pageCount = computed(() => getPageCount(chartTracks.value.length, gridOptions.value))
  const pagedTracks = computed(() =>
    paginateSeries(chartTracks.value, currentPage.value, gridOptions.value),
  )
  const yAxisMetrics = computed(() => {
    const axisText = chartTracks.value
      .filter((track) => track.visibleSeries.length > 0)
      .flatMap((track) =>
        resolveYAxisSeriesGroups(track, props.overlayMode, props.yDomain, props.yDomains),
      )
      .map((group) => axisTextMetrics(group.domain, !group.fixed).tickTextWidth)
    const tickTextWidth = Math.max(Y_AXIS_CHARACTER_WIDTH, ...axisText)
    const tickClearance = tickTextWidth + Y_AXIS_TICK_PADDING + Y_AXIS_OUTER_PADDING
    const labelCenterX = -(
      Y_AXIS_TICK_PADDING +
      tickTextWidth +
      Y_AXIS_LABEL_GAP +
      Y_AXIS_LABEL_BAND_WIDTH / 2
    )
    const fullClearance =
      tickTextWidth +
      Y_AXIS_TICK_PADDING +
      Y_AXIS_LABEL_GAP +
      Y_AXIS_LABEL_BAND_WIDTH +
      Y_AXIS_OUTER_PADDING
    return { tickClearance, fullClearance, labelCenterX }
  })
  const hasYAxisLabels = computed(() =>
    chartTracks.value.some(
      (track) =>
        track.visibleSeries.length === 1 &&
        Boolean(track.visibleSeries[0]?.name.trim() || props.yLabel),
    ),
  )
  const hasVisibleWaveformData = computed(() =>
    chartTracks.value.some((track) => track.visibleSeries.length > 0),
  )
  const chartLeftMargin = computed(() =>
    Math.max(
      margin.left,
      hasYAxisLabels.value
        ? yAxisMetrics.value.fullClearance
        : hasVisibleWaveformData.value
          ? yAxisMetrics.value.tickClearance
          : 0,
    ),
  )
  const multiAxisClearance = computed(() =>
    chartTracks.value.reduce(
      (maximum, track) => {
        const clearance = measureTrackYAxisClearance(
          track,
          props.overlayMode,
          props.yDomain,
          props.yDomains,
        )
        return {
          left: Math.max(maximum.left, clearance.left),
          right: Math.max(maximum.right, clearance.right),
        }
      },
      { left: 0, right: 0 },
    ),
  )
  const resolvedChartLeftMargin = computed(() =>
    props.overlayMode === 'multi-axis'
      ? Math.max(chartLeftMargin.value, multiAxisClearance.value.left)
      : chartLeftMargin.value,
  )
  const chartRightMargin = computed(() =>
    props.overlayMode === 'multi-axis'
      ? Math.max(margin.right, multiAxisClearance.value.right)
      : margin.right,
  )
  const innerWidth = computed(() =>
    Math.max(0, chartWidth.value - resolvedChartLeftMargin.value - chartRightMargin.value),
  )
  const yAxisLayout = computed(() => {
    const baseGap = getGridGap(props.displayMode)
    const columnCount = gridOptions.value.columnCount
    const hasMultipleColumns = columnCount > 1
    const fullGap = Math.max(baseGap, yAxisMetrics.value.fullClearance)
    const tickGap = Math.max(baseGap, yAxisMetrics.value.tickClearance)
    const plotWidth = (innerWidth.value - fullGap * Math.max(0, columnCount - 1)) / columnCount
    const canReserveLabelClearance = plotWidth >= MINIMUM_PLOT_WIDTH
    return {
      horizontalGap:
        props.overlayMode === 'multi-axis' && hasMultipleColumns && hasVisibleWaveformData.value
          ? Math.max(baseGap, multiAxisClearance.value.left + multiAxisClearance.value.right)
          : hasMultipleColumns && hasVisibleWaveformData.value
            ? hasYAxisLabels.value && canReserveLabelClearance
              ? fullGap
              : tickGap
            : baseGap,
      hideSecondaryLabels:
        props.overlayMode !== 'multi-axis' &&
        hasMultipleColumns &&
        hasYAxisLabels.value &&
        !canReserveLabelClearance,
    }
  })
  const hasWaveformData = computed(() => chartSeries.value.length > 0)
  const hasChartArea = computed(() => innerWidth.value > 0 && innerHeight.value > 0)
  const resolvedXLabel = computed(() => props.xLabel ?? `时间（${props.timeUnit}）`)
  const activeInteractionMode = computed(() => props.interactionMode)
  const isZoomMode = computed(
    () => activeInteractionMode.value === 'zoom' || activeInteractionMode.value === undefined,
  )
  const sharedXDomain = computed(() => {
    const values: number[] = []
    chartTracks.value.forEach((track) => {
      if (track.visibleSeries.length) values.push(track.xDomain[0], track.xDomain[1])
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
      return applyXDomainStrategy(
        domain[0] < domain[1] ? domain : [domain[1], domain[0]],
        props.xDomainStrategy,
        true,
      )
    }
    return applyXDomainStrategy(sharedXDomain.value, props.xDomainStrategy)
  })
  const resolveInitialTrackDomain = (track: TrackLayout): [number, number] => {
    const configuredDomain =
      props.initialXDomains?.[track.series.trackId ?? track.series.id] ??
      props.initialXDomains?.[track.series.id] ??
      props.initialXDomain
    if (
      configuredDomain &&
      Number.isFinite(configuredDomain[0]) &&
      Number.isFinite(configuredDomain[1]) &&
      configuredDomain[0] !== configuredDomain[1]
    ) {
      return applyXDomainStrategy(
        configuredDomain[0] < configuredDomain[1]
          ? configuredDomain
          : [configuredDomain[1], configuredDomain[0]],
        props.xDomainStrategy,
        true,
      )
    }
    return applyXDomainStrategy(
      paddedDomain(track.seriesList.flatMap((series) => series.xDomain)),
      props.xDomainStrategy,
    )
  }
  const sharedZoomDomain = computed(
    () =>
      sharedTransform.value
        .rescaleX(scaleLinear(initialXDomain.value, [0, innerWidth.value]))
        .domain() as [number, number],
  )
  const gridCells = computed(() => {
    const cells = resolveGridCellGeometry(
      innerWidth.value,
      innerHeight.value,
      gridOptions.value,
      props.displayMode,
      pagedTracks.value.map(Boolean),
      yAxisLayout.value.horizontalGap,
    )
    return cells.map((cell, index) => ({ ...cell, series: pagedTracks.value[index] }))
  })
  const trackLayouts = computed<TrackLayout[]>(() =>
    buildTrackLayouts({
      cells: gridCells.value,
      grid: gridOptions.value,
      displayMode: props.displayMode,
      overlayMode: props.overlayMode,
      independentTransforms: independentTransforms.value,
      sharedZoomDomain: sharedZoomDomain.value,
      initialXDomain: props.initialXDomain ? initialXDomain.value : undefined,
      initialXDomains: props.initialXDomains,
      xDomainStrategy: props.xDomainStrategy,
      fixedYDomain: props.yDomain,
      fixedYDomains: props.yDomains,
      yDomains:
        props.displayMode === 'independent'
          ? Object.fromEntries(
              chartTracks.value.flatMap((track, index) => {
                const domain = independentYDomains.value[index]
                return domain ? [[track.id, domain]] : []
              }),
            )
          : sharedYDomains.value,
      timeUnit: props.timeUnit,
      xAxisLabelFormatter: props.axes?.x?.labelFormatter,
      rendering: renderingOptions.value,
      hideSecondaryLabels: isCleanView.value || yAxisLayout.value.hideSecondaryLabels,
      yAxisLabelX: yAxisMetrics.value.labelCenterX,
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
  const resolveFrameNumber = (trackIndex: number): string | number | undefined => {
    if (props.frameNumber === undefined || props.frameNumber === null) return undefined
    if (chartTracks.value.length === 1) return props.frameNumber
    return typeof props.frameNumber === 'number'
      ? props.frameNumber + trackIndex
      : `${props.frameNumber}-${trackIndex + 1}`
  }

  return {
    chartSeries,
    chartTracks,
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

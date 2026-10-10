import { computed, type ComputedRef } from 'vue'

import { margin, MINIMUM_PLOT_WIDTH } from './constants'
import { getGridGap, type NormalizedWaveformGridOptions } from './grid'
import { buildYAxisSlots } from './layout'
import type { DisplayTrack } from './types'
import type { ResolvedWaveformChartProps } from './waveformChartTypes'
import { resolveYAxisLayoutMetrics } from './yAxisLayoutMetrics'
import { Y_AXIS_OUTER_PADDING } from './yAxisConstants'
import { measureYAxisTextWidth } from './yAxisTextWidth'

interface YAxisLayoutContext {
  props: ResolvedWaveformChartProps
  chartTracks: ComputedRef<DisplayTrack[]>
  layoutTracks: ComputedRef<DisplayTrack[]>
  chartWidth: ComputedRef<number>
  gridOptions: ComputedRef<NormalizedWaveformGridOptions>
  viewportYDomains: ComputedRef<Record<string, [number, number]>>
  yAxisTickCount: ComputedRef<number>
}

export function useWaveformYAxisLayout(context: YAxisLayoutContext) {
  const {
    props,
    chartTracks,
    layoutTracks,
    chartWidth,
    gridOptions,
    viewportYDomains,
    yAxisTickCount,
  } = context
  const isEdgeCompact = computed(() => props.layoutPreset === 'edge-compact')
  const showUnits = computed(() => !isEdgeCompact.value || props.unitDisplayMode === 'axis')
  const yAxisMetrics = computed(() =>
    resolveYAxisLayoutMetrics(
      chartTracks.value,
      props.overlayMode,
      props.yDomain,
      props.yDomains,
      viewportYDomains.value,
      props.axes?.y?.nice !== false,
      yAxisTickCount.value,
      props.displayMode === 'compact',
      props.axes?.y?.upperPaddingRatio,
      showUnits.value,
      isEdgeCompact.value ? measureYAxisTextWidth : undefined,
    ),
  )
  const hasYAxisLabels = computed(() =>
    chartTracks.value.some((track) => {
      const series = track.visibleSeries.length ? track.visibleSeries : track.series
      return series.length === 1 && Boolean(series[0]?.name.trim() || props.yLabel)
    }),
  )
  const hasVisibleWaveformData = computed(() =>
    chartTracks.value.some((track) => track.visibleSeries.length > 0),
  )
  const hasAxisData = computed(() => chartTracks.value.some((track) => track.series.length > 0))
  const chartLeftMargin = computed(() =>
    Math.max(
      margin.left,
      hasYAxisLabels.value
        ? yAxisMetrics.value.fullClearance
        : hasAxisData.value
          ? yAxisMetrics.value.tickClearance
          : 0,
    ),
  )
  const yAxisSlots = computed(() =>
    buildYAxisSlots(
      layoutTracks.value.filter((track) => track.series.length > 0),
      props.overlayMode,
      props.yDomain,
      props.yDomains,
      yAxisTickCount.value,
      props.axes?.y?.nice !== false,
      props.displayMode === 'compact',
      viewportYDomains.value,
      props.axes?.y?.upperPaddingRatio,
      showUnits.value,
      isEdgeCompact.value ? measureYAxisTextWidth : undefined,
    ),
  )
  const resolvedChartLeftMargin = computed(() =>
    isEdgeCompact.value
      ? margin.right / 4 + Math.max(0, compactLeftClearance.value - Y_AXIS_OUTER_PADDING)
      : props.overlayMode === 'multi-axis'
        ? Math.max(chartLeftMargin.value, yAxisSlots.value.clearance.left)
        : chartLeftMargin.value,
  )
  // The same slot places the title and reserves its entire 20px band. The outer
  // padding belongs to the chart edge, rather than the old fixed 48px minimum.
  const compactLeftClearance = computed(() =>
    !hasAxisData.value
      ? 0
      : props.overlayMode === 'multi-axis' || hasYAxisLabels.value
        ? yAxisSlots.value.clearance.left
        : yAxisMetrics.value.tickClearance,
  )
  const chartRightMargin = computed(() =>
    props.overlayMode === 'multi-axis'
      ? Math.max(margin.right, yAxisSlots.value.clearance.right)
      : margin.right,
  )
  const innerWidth = computed(() =>
    Math.max(0, chartWidth.value - resolvedChartLeftMargin.value - chartRightMargin.value),
  )
  const yAxisLayout = computed(() => {
    const baseGap = getGridGap(props.displayMode)
    const columnCount = gridOptions.value.columnCount
    const hasMultipleColumns = columnCount > 1
    const fullGap = Math.max(
      baseGap,
      isEdgeCompact.value ? yAxisSlots.value.clearance.left : yAxisMetrics.value.fullClearance,
    )
    const tickGap = Math.max(baseGap, yAxisMetrics.value.tickClearance)
    const plotWidth = (innerWidth.value - fullGap * Math.max(0, columnCount - 1)) / columnCount
    const canReserveLabelClearance = plotWidth >= MINIMUM_PLOT_WIDTH
    return {
      horizontalGap:
        props.overlayMode === 'multi-axis' && hasMultipleColumns && hasAxisData.value
          ? Math.max(baseGap, yAxisSlots.value.clearance.left + yAxisSlots.value.clearance.right)
          : hasMultipleColumns && hasAxisData.value
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
  return {
    yAxisMetrics,
    yAxisSlots,
    resolvedChartLeftMargin,
    innerWidth,
    yAxisLayout,
    hasVisibleWaveformData,
  }
}

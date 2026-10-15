import { computed, type ComputedRef } from 'vue'

import { margin, MINIMUM_PLOT_WIDTH } from './constants'
import { getGridGap, type NormalizedWaveformGridOptions } from './grid'
import type { DisplayTrack } from './types'
import type { ResolvedWaveformChartProps } from './waveformChartTypes'
import { Y_AXIS_OUTER_PADDING } from './yAxisConstants'
import { fitYAxisSlotsToMargins, resolveStableYAxisLayout } from './yAxisStableLayout'

interface YAxisLayoutContext {
  props: ResolvedWaveformChartProps
  chartTracks: ComputedRef<DisplayTrack[]>
  layoutTracks: ComputedRef<DisplayTrack[]>
  chartWidth: ComputedRef<number>
  gridOptions: ComputedRef<NormalizedWaveformGridOptions>
}

export function useWaveformYAxisLayout(context: YAxisLayoutContext) {
  const { props, chartTracks, layoutTracks, chartWidth, gridOptions } = context
  const isEdgeCompact = computed(() => props.layoutPreset === 'edge-compact')
  const showUnits = computed(
    () =>
      props.unitDisplayMode !== 'channel-label' &&
      props.unitDisplayMode !== 'channel-label-or-legend' &&
      (!isEdgeCompact.value || props.unitDisplayMode === 'axis'),
  )
  const yAxisMetrics = computed(
    () =>
      resolveStableYAxisLayout(chartTracks.value, props.overlayMode, {
        showUnits: showUnits.value,
        labelTextStyle: props.axes?.y?.labelTextStyle,
      }).metrics,
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
  const baseYAxisSlots = computed(() =>
    resolveStableYAxisLayout(layoutTracks.value, props.overlayMode, {
      showUnits: showUnits.value,
      labelTextStyle: props.axes?.y?.labelTextStyle,
    }),
  )
  const resolvedChartLeftMargin = computed(() =>
    isEdgeCompact.value
      ? margin.right / 4 + Math.max(0, compactLeftClearance.value - Y_AXIS_OUTER_PADDING)
      : props.overlayMode === 'multi-axis'
        ? Math.max(chartLeftMargin.value, baseYAxisSlots.value.clearance.left)
        : chartLeftMargin.value,
  )
  // Edge padding stays outside the name's fixed gap to the numeric region.
  const compactLeftClearance = computed(() =>
    !hasAxisData.value
      ? 0
      : props.overlayMode === 'multi-axis' || hasYAxisLabels.value
        ? baseYAxisSlots.value.clearance.left
        : yAxisMetrics.value.tickClearance,
  )
  const chartRightMargin = computed(() =>
    props.overlayMode === 'multi-axis'
      ? Math.max(margin.right, baseYAxisSlots.value.clearance.right)
      : margin.right,
  )
  const yAxisSlots = computed(() =>
    fitYAxisSlotsToMargins(baseYAxisSlots.value, {
      left: resolvedChartLeftMargin.value,
      right: chartRightMargin.value,
    }),
  )
  const availableInnerWidth = computed(() =>
    Math.max(0, chartWidth.value - resolvedChartLeftMargin.value - chartRightMargin.value),
  )
  const multiAxisGap = computed(() =>
    Math.max(
      getGridGap(props.displayMode),
      yAxisSlots.value.clearance.left + yAxisSlots.value.clearance.right,
    ),
  )
  const innerWidth = computed(() => {
    const columns = gridOptions.value.columnCount
    return props.overlayMode === 'multi-axis' && hasAxisData.value
      ? Math.max(
          availableInnerWidth.value,
          MINIMUM_PLOT_WIDTH * columns + multiAxisGap.value * (columns - 1),
        )
      : availableInnerWidth.value
  })
  const renderedChartWidth = computed(() =>
    props.overlayMode === 'multi-axis' && hasAxisData.value
      ? Math.max(
          chartWidth.value,
          resolvedChartLeftMargin.value + innerWidth.value + chartRightMargin.value,
        )
      : chartWidth.value,
  )
  const yAxisLayout = computed(() => {
    const baseGap = getGridGap(props.displayMode)
    const columnCount = gridOptions.value.columnCount
    const hasMultipleColumns = columnCount > 1
    const fullGap = Math.max(baseGap, yAxisSlots.value.clearance.left)
    const tickGap = Math.max(baseGap, yAxisMetrics.value.tickClearance)
    const plotWidth = (innerWidth.value - fullGap * Math.max(0, columnCount - 1)) / columnCount
    const canReserveLabelClearance = plotWidth >= MINIMUM_PLOT_WIDTH
    return {
      horizontalGap:
        props.overlayMode === 'multi-axis' && hasMultipleColumns && hasAxisData.value
          ? multiAxisGap.value
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
    renderedChartWidth,
    yAxisLayout,
    hasVisibleWaveformData,
  }
}

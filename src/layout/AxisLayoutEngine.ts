import { margin, MINIMUM_PLOT_WIDTH } from '../components/core/constants'
import { getGridGap, type NormalizedWaveformGridOptions } from '../components/core/grid'
import {
  fitYAxisSlotsToMargins,
  resolveStableYAxisLayout,
} from '../components/core/yAxisStableLayout'
import { Y_AXIS_OUTER_PADDING } from '../components/core/yAxisConstants'
import type { DisplayTrack } from '../components/core/types'
import type { ResolvedWaveformChartProps } from '../types/options'

export class AxisLayoutEngine {
  calculate(
    options: ResolvedWaveformChartProps,
    tracks: DisplayTrack[],
    pageTracks: DisplayTrack[],
    grid: NormalizedWaveformGridOptions,
    width: number,
    _height: number,
    _yDomains: Record<string, [number, number]>,
    _tickCount?: number,
  ) {
    // Older internal callers supply viewport metrics; axis spacing now uses stable budgets.
    void _height
    void _yDomains
    void _tickCount
    const edge = options.layoutPreset === 'edge-compact'
    const showUnits =
      options.unitDisplayMode !== 'channel-label' &&
      options.unitDisplayMode !== 'channel-label-or-legend' &&
      (!edge || options.unitDisplayMode === 'axis')
    const stableOptions = { showUnits, labelTextStyle: options.axes?.y?.labelTextStyle }
    const metrics = resolveStableYAxisLayout(tracks, options.overlayMode, stableOptions).metrics
    const baseSlots = resolveStableYAxisLayout(pageTracks, options.overlayMode, stableOptions)
    const hasData = tracks.some((track) => track.series.length > 0)
    const hasLabels = tracks.some((track) => {
      const series = track.visibleSeries.length ? track.visibleSeries : track.series
      return series.length === 1 && Boolean(series[0]?.name.trim() || options.yLabel)
    })
    const chartLeft = Math.max(
      margin.left,
      hasLabels ? metrics.fullClearance : hasData ? metrics.tickClearance : 0,
    )
    const compactLeft = !hasData
      ? 0
      : options.overlayMode === 'multi-axis' || hasLabels
        ? baseSlots.clearance.left
        : metrics.tickClearance
    const left = edge
      ? margin.right / 4 + Math.max(0, compactLeft - Y_AXIS_OUTER_PADDING)
      : options.overlayMode === 'multi-axis'
        ? Math.max(chartLeft, baseSlots.clearance.left)
        : chartLeft
    const right =
      options.overlayMode === 'multi-axis'
        ? Math.max(margin.right, baseSlots.clearance.right)
        : margin.right
    const slots = fitYAxisSlotsToMargins(baseSlots, { left, right })
    const availableWidth = Math.max(0, width - left - right)
    const multiAxisGap = Math.max(
      getGridGap(options.displayMode),
      slots.clearance.left + slots.clearance.right,
    )
    const innerWidth =
      options.overlayMode === 'multi-axis' && hasData
        ? Math.max(
            availableWidth,
            MINIMUM_PLOT_WIDTH * grid.columnCount + multiAxisGap * (grid.columnCount - 1),
          )
        : availableWidth
    const renderedWidth =
      options.overlayMode === 'multi-axis' && hasData
        ? Math.max(width, left + innerWidth + right)
        : width
    const gap = getGridGap(options.displayMode)
    const fullGap = Math.max(gap, slots.clearance.left)
    const tickGap = Math.max(gap, metrics.tickClearance)
    const columns = grid.columnCount
    const canReserve =
      (innerWidth - fullGap * Math.max(0, columns - 1)) / columns >= MINIMUM_PLOT_WIDTH
    const horizontalGap =
      options.overlayMode === 'multi-axis' && columns > 1 && hasData
        ? multiAxisGap
        : columns > 1 && hasData
          ? hasLabels && canReserve
            ? fullGap
            : tickGap
          : gap
    return {
      left,
      right,
      innerWidth,
      renderedWidth,
      horizontalGap,
      showUnits,
      slots: slots.slots,
      slotLayout: slots,
      metrics,
      hasVisibleWaveformData: tracks.some((track) => track.visibleSeries.length > 0),
      labelX:
        slots.slots.find((slot) => slot.side === 'left' && slot.sideIndex === 0)?.labelOffset ??
        metrics.labelCenterX,
      hideSecondaryLabels:
        options.overlayMode !== 'multi-axis' && columns > 1 && hasLabels && !canReserve,
    }
  }
}

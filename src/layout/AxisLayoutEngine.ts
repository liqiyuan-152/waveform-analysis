import { margin, MINIMUM_PLOT_WIDTH } from '../components/core/constants'
import { getGridGap, type NormalizedWaveformGridOptions } from '../components/core/grid'
import { buildYAxisSlots, resolveYAxisTickCount } from '../components/core/layout'
import { resolveYAxisLayoutMetrics } from '../components/core/yAxisLayoutMetrics'
import { measureYAxisTextWidth } from '../components/core/yAxisTextWidth'
import { Y_AXIS_OUTER_PADDING } from '../components/core/yAxisConstants'
import type { DisplayTrack } from '../components/core/types'
import type { ResolvedWaveformChartProps } from '../types/options'

export class AxisLayoutEngine {
  constructor(private readonly measureTextWidth = measureYAxisTextWidth) {}

  calculate(
    options: ResolvedWaveformChartProps,
    tracks: DisplayTrack[],
    pageTracks: DisplayTrack[],
    grid: NormalizedWaveformGridOptions,
    width: number,
    height: number,
    yDomains: Record<string, [number, number]>,
    tickCount = resolveYAxisTickCount(height, options.axes?.y?.splitNumber),
  ) {
    const edge = options.layoutPreset === 'edge-compact'
    const showUnits =
      options.unitDisplayMode !== 'channel-label' &&
      options.unitDisplayMode !== 'channel-label-or-legend' &&
      (!edge || options.unitDisplayMode === 'axis')
    const nice = options.axes?.y?.nice !== false
    const compact = options.displayMode === 'compact'
    const measure = edge ? this.measureTextWidth : undefined
    const metrics = resolveYAxisLayoutMetrics(
      tracks,
      options.overlayMode,
      options.yDomain,
      options.yDomains,
      yDomains,
      nice,
      tickCount,
      compact,
      options.axes?.y,
      showUnits,
      measure,
      options.amplitudeLimits,
    )
    const slots = buildYAxisSlots(
      pageTracks.filter((track) => track.series.length > 0),
      options.overlayMode,
      options.yDomain,
      options.yDomains,
      tickCount,
      nice,
      compact,
      yDomains,
      options.axes?.y,
      showUnits,
      measure,
      options.amplitudeLimits,
    )
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
        ? slots.clearance.left
        : metrics.tickClearance
    const left = edge
      ? margin.right / 4 + Math.max(0, compactLeft - Y_AXIS_OUTER_PADDING)
      : options.overlayMode === 'multi-axis'
        ? Math.max(chartLeft, slots.clearance.left)
        : chartLeft
    const right =
      options.overlayMode === 'multi-axis'
        ? Math.max(margin.right, slots.clearance.right)
        : margin.right
    const innerWidth = Math.max(0, width - left - right)
    const gap = getGridGap(options.displayMode)
    const fullGap = Math.max(gap, edge ? slots.clearance.left : metrics.fullClearance)
    const tickGap = Math.max(gap, metrics.tickClearance)
    const columns = grid.columnCount
    const canReserve =
      (innerWidth - fullGap * Math.max(0, columns - 1)) / columns >= MINIMUM_PLOT_WIDTH
    const horizontalGap =
      options.overlayMode === 'multi-axis' && columns > 1 && hasData
        ? Math.max(gap, slots.clearance.left + slots.clearance.right)
        : columns > 1 && hasData
          ? hasLabels && canReserve
            ? fullGap
            : tickGap
          : gap
    return {
      left,
      right,
      innerWidth,
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

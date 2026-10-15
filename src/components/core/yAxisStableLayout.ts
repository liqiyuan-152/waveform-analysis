import type { WaveformOverlayMode, WaveformYAxisLabelTextStyle } from '../../types'
import { buildYAxisSeriesGroups, type YAxisSlot } from './layout'
import type { DisplayTrack } from './types'
import type { YAxisLayoutMetrics } from './yAxisLayoutMetrics'
import { mergeYAxisSpaceBudgets, resolveYAxisSpaceBudget } from './yAxisSpaceBudget'

interface StableYAxisOptions {
  showUnits: boolean
  labelTextStyle?: WaveformYAxisLabelTextStyle
}

/** Axis geometry depends on the series metadata, never on the viewport's ticks. */
export function resolveStableYAxisLayout(
  tracks: readonly DisplayTrack[],
  overlayMode: WaveformOverlayMode,
  options: StableYAxisOptions,
) {
  const budgets = new Map<string, ReturnType<typeof resolveYAxisSpaceBudget>>()
  const slotBudgets = new Map<string, ReturnType<typeof resolveYAxisSpaceBudget>>()
  const metrics: YAxisLayoutMetrics = { tickClearance: 0, fullClearance: 0, labelCenterX: 0 }

  for (const track of tracks) {
    const axisTrack = track.visibleSeries.length ? track : { ...track, visibleSeries: track.series }
    const sideIndexes = { left: 0, right: 0 }
    for (const group of buildYAxisSeriesGroups(axisTrack, overlayMode)) {
      const unit = options.showUnits ? (group.seriesList[0]?.unit?.trim() ?? '') : ''
      let budget = budgets.get(unit)
      if (!budget) {
        budget = resolveYAxisSpaceBudget({ unit, labelTextStyle: options.labelTextStyle })
        budgets.set(unit, budget)
      }
      metrics.tickClearance = Math.max(metrics.tickClearance, budget.tickClearance)
      metrics.fullClearance = Math.max(metrics.fullClearance, budget.clearance)
      metrics.labelCenterX = Math.min(metrics.labelCenterX, -budget.titleDistance)
      const key = `${group.side}:${sideIndexes[group.side]++}`
      const previous = slotBudgets.get(key)
      slotBudgets.set(key, previous ? mergeYAxisSpaceBudgets(previous, budget) : budget)
    }
  }

  const slots: YAxisSlot[] = []
  const clearance = { left: 0, right: 0 }
  for (const side of ['left', 'right'] as const) {
    const direction = side === 'left' ? -1 : 1
    for (let sideIndex = 0; slotBudgets.has(`${side}:${sideIndex}`); sideIndex++) {
      const budget = slotBudgets.get(`${side}:${sideIndex}`)!
      const axisOffset = clearance[side] === 0 ? 0 : direction * clearance[side]
      slots.push({
        side,
        sideIndex,
        axisOffset,
        labelOffset: axisOffset + direction * budget.titleDistance,
        clearance: budget.clearance,
      })
      clearance[side] += budget.clearance
    }
  }
  return { slots, clearance, metrics }
}

/** Keep extra chart-edge space outside the name's fixed numeric clearance. */
export function fitYAxisSlotsToMargins(
  layout: ReturnType<typeof resolveStableYAxisLayout>,
  margins: { left: number; right: number },
): ReturnType<typeof resolveStableYAxisLayout> {
  const slots = layout.slots.map((slot) => ({ ...slot }))
  const clearance = { ...layout.clearance }
  for (const side of ['left', 'right'] as const) {
    const outer = slots.filter((slot) => slot.side === side).at(-1)
    if (!outer) continue
    const extra = Math.max(0, margins[side] - clearance[side])
    outer.clearance += extra
    clearance[side] += extra
  }
  return { ...layout, slots, clearance }
}

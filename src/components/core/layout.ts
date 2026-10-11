import type { WaveformOverlayMode } from '../../types'
import { formatScientificAxisLabel, formatScientificAxisExponent, paddedDomain } from '../../utils'
import type { DisplaySeries, DisplayTrack, TrackLayout } from './types'
import { MAX_MULTI_Y_AXIS_COUNT } from './constants'
import {
  mergeYDomains,
  resolveSeriesFixedYDomain,
  resolveTrackFixedYDomain,
  type WaveformYDomain,
} from './yDomain'
import { resolveYAxisTicksECharts } from './niceScale'
import { applyYAxisPadding, withMaximumTick, type YAxisPaddingOptions } from './yAxisPadding'

// 导出常量供外部使用
export { MAX_MULTI_Y_AXIS_COUNT } from './constants'

const Y_AXIS_CHARACTER_WIDTH = 7
const Y_AXIS_TICK_PADDING = 7
const Y_AXIS_OUTER_PADDING = 4
const Y_AXIS_LABEL_GAP = 0
const Y_AXIS_LABEL_BAND_WIDTH = 20

export function resolveYAxisTickCount(_plotHeight: number, splitNumber?: number): number {
  if (typeof splitNumber === 'number' && Number.isFinite(splitNumber)) {
    return Math.max(2, Math.floor(splitNumber))
  }
  return 5
}

export interface ResolvedYAxisTicks {
  domain: [number, number]
  values: number[]
}

export function resolveYAxisTicks(
  domain: [number, number],
  tickCount = 5,
  nice = true,
): ResolvedYAxisTicks {
  if (!nice) {
    // 如果不需要 nice，使用简单的线性分割
    const effectiveTickCount =
      typeof tickCount === 'number' && Number.isFinite(tickCount)
        ? Math.max(2, Math.floor(tickCount))
        : 5
    const [axisStart, axisEnd] = domain
    return {
      domain,
      values: Array.from(
        { length: effectiveTickCount },
        (_, index) => axisStart + ((axisEnd - axisStart) * index) / (effectiveTickCount - 1),
      ),
    }
  }

  // 使用 ECharts 兼容的 1/2/5 系列算法
  return resolveYAxisTicksECharts(domain, tickCount)
}

export function formatYAxisTickLabel(
  value: number,
  domain: [number, number],
  tickValues: readonly number[],
  unit?: string,
  side: 'left' | 'right' = 'left',
): string {
  const topTickValue = Math.max(...tickValues)
  const suffixMetadata = side === 'right' && value === topTickValue
  const label = formatScientificAxisLabel(value, {
    axisMin: domain[0],
    axisMax: domain[1],
    topTickValue: suffixMetadata ? Number.NaN : topTickValue,
    unit: suffixMetadata ? undefined : unit,
  })
  if (suffixMetadata) {
    const unitLabel = unit?.trim()
    return [label, formatScientificAxisExponent(...domain), unitLabel ? `(${unitLabel})` : null]
      .filter(Boolean)
      .join(' ')
  }
  return label
}

/** Scientific multipliers retain their rendered position but do not reserve horizontal space. */
export function formatYAxisTickLayoutLabel(
  value: number,
  domain: [number, number],
  tickValues: readonly number[],
  unit?: string,
): string {
  const label = formatYAxisTickLabel(value, domain, tickValues, unit)
  const exponent = formatScientificAxisExponent(domain[0], domain[1])
  return exponent && label.startsWith(`${exponent} `) ? label.slice(exponent.length + 1) : label
}

export interface YAxisSeriesGroup {
  index: number
  side: 'left' | 'right'
  seriesList: DisplaySeries[]
  domain: [number, number]
  fixed: boolean
  maximumTick?: number
}

export interface YAxisSlot {
  side: 'left' | 'right'
  sideIndex: number
  axisOffset: number
  labelOffset: number
  clearance: number
}

function resolveAxisSides(axisCount: number): Array<'left' | 'right'> {
  if (axisCount >= 4) return ['left', 'left', 'right', 'right']
  if (axisCount === 3) return ['left', 'right', 'right']
  if (axisCount === 2) return ['left', 'right']
  return ['left']
}

// 使用 WeakMap 进行缓存优化，避免手动清理
const yAxisGroupsCache = new WeakMap<DisplayTrack, Map<WaveformOverlayMode, YAxisSeriesGroup[]>>()

export function buildYAxisSeriesGroups(
  track: DisplayTrack,
  overlayMode: WaveformOverlayMode,
): YAxisSeriesGroup[] {
  let trackCache = yAxisGroupsCache.get(track)
  if (!trackCache) {
    trackCache = new Map()
    yAxisGroupsCache.set(track, trackCache)
  }

  const cached = trackCache.get(overlayMode)
  if (cached) return cached
  const axisCount =
    overlayMode === 'multi-axis'
      ? Math.min(track.visibleSeries.length, MAX_MULTI_Y_AXIS_COUNT)
      : Math.min(track.visibleSeries.length, 1)
  const sides = resolveAxisSides(axisCount)
  const grouped = Array.from({ length: axisCount }, (_, index) => ({
    index,
    side: sides[index],
    seriesList: [] as DisplaySeries[],
    domain: [0, 1] as [number, number],
    fixed: false,
  }))

  track.visibleSeries.forEach((series, index) => {
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

export function resolveYAxisSeriesGroups(
  track: DisplayTrack,
  overlayMode: WaveformOverlayMode,
  yDomain?: WaveformYDomain,
  yDomains?: Record<string, WaveformYDomain>,
): YAxisSeriesGroup[] {
  const trackDomain = resolveTrackFixedYDomain(track, yDomains)
  return buildYAxisSeriesGroups(track, overlayMode).map((group) => {
    if (trackDomain) return { ...group, domain: trackDomain, fixed: true }
    const seriesDomains = group.seriesList.map(
      (series) => resolveSeriesFixedYDomain(series, yDomain, yDomains) ?? series.yDomain,
    )
    const fixed = group.seriesList.some((series) =>
      resolveSeriesFixedYDomain(series, yDomain, yDomains),
    )
    return fixed ? { ...group, domain: mergeYDomains(seriesDomains), fixed } : group
  })
}

export function resolveRenderedYAxisSeriesGroups(
  track: DisplayTrack,
  overlayMode: WaveformOverlayMode,
  yDomain?: WaveformYDomain,
  yDomains?: Record<string, WaveformYDomain>,
  viewportYDomains?: Record<string, [number, number]>,
  padding?: YAxisPaddingOptions | number,
): YAxisSeriesGroup[] {
  const viewportYDomain = viewportYDomains?.[track.id]
  const axisTrack =
    track.visibleSeries.length || !track.series.length
      ? track
      : { ...track, visibleSeries: track.series }
  return resolveYAxisSeriesGroups(axisTrack, overlayMode, yDomain, yDomains).map((group) =>
    applyYAxisPadding(group, viewportYDomain, padding),
  )
}

export function axisTextMetrics(
  domain: [number, number],
  nice = true,
  tickValues?: number[],
  unit?: string,
  tickCount = 5,
  includeWithoutLastTick = false,
  measureTextWidth?: (text: string) => number,
  maximumTick?: number,
): { tickTextWidth: number } {
  const resolvedTicks = tickValues
    ? { domain, values: tickValues }
    : resolveYAxisTicks(domain, tickCount, nice)
  const tickValueSets = [withMaximumTick(resolvedTicks.values, maximumTick)]
  if (includeWithoutLastTick && resolvedTicks.values.length > 1) {
    tickValueSets.push(resolvedTicks.values.slice(0, -1))
  }
  const maximumTickWidth = Math.max(
    Y_AXIS_CHARACTER_WIDTH,
    ...tickValueSets.flatMap((values) =>
      values.map((value) => {
        const text = formatYAxisTickLayoutLabel(value, resolvedTicks.domain, values, unit)
        return measureTextWidth ? measureTextWidth(text) : text.length * Y_AXIS_CHARACTER_WIDTH
      }),
    ),
  )
  return {
    tickTextWidth: maximumTickWidth,
  }
}

export function measureYAxisGroupClearance(
  group: YAxisSeriesGroup,
  tickCount?: number,
  nice = true,
): number {
  return (
    axisTextMetrics(group.domain, nice, undefined, group.seriesList[0]?.unit, tickCount)
      .tickTextWidth +
    Y_AXIS_TICK_PADDING +
    Y_AXIS_LABEL_GAP +
    Y_AXIS_LABEL_BAND_WIDTH +
    Y_AXIS_OUTER_PADDING
  )
}

function measureYAxisGroupTickClearance(
  group: YAxisSeriesGroup,
  tickCount?: number,
  nice = true,
): number {
  return (
    axisTextMetrics(group.domain, nice, undefined, group.seriesList[0]?.unit, tickCount)
      .tickTextWidth +
    Y_AXIS_TICK_PADDING +
    Y_AXIS_OUTER_PADDING
  )
}

export function measureTrackYAxisClearance(
  track: DisplayTrack,
  overlayMode: WaveformOverlayMode,
  yDomain?: WaveformYDomain,
  yDomains?: Record<string, WaveformYDomain>,
  tickCount?: number,
  nice = true,
): { left: number; right: number } {
  return resolveYAxisSeriesGroups(track, overlayMode, yDomain, yDomains).reduce(
    (clearance, group) => {
      clearance[group.side] +=
        overlayMode === 'multi-axis' || track.visibleSeries.length === 1
          ? measureYAxisGroupClearance(group, tickCount, nice)
          : measureYAxisGroupTickClearance(group, tickCount, nice)
      return clearance
    },
    { left: 0, right: 0 },
  )
}

/**
 * Reserves stable Y-axis positions for every visible track on the current page.
 * Slots are ordered from the plot edge outward for each side.
 */
export function buildYAxisSlots(
  tracks: readonly DisplayTrack[],
  overlayMode: WaveformOverlayMode,
  yDomain?: WaveformYDomain,
  yDomains?: Record<string, WaveformYDomain>,
  tickCount?: number,
  nice = true,
  includeWithoutLastTick = false,
  viewportYDomains?: Record<string, [number, number]>,
  padding?: YAxisPaddingOptions | number,
  showUnits = true,
  measureTextWidth?: (text: string) => number,
): { slots: YAxisSlot[]; clearance: { left: number; right: number } } {
  const widths = new Map<string, number>()
  tracks.forEach((track) => {
    const sideIndexes = { left: 0, right: 0 }
    resolveRenderedYAxisSeriesGroups(
      track,
      overlayMode,
      yDomain,
      yDomains,
      viewportYDomains,
      padding,
    ).forEach((group) => {
      const sideIndex = sideIndexes[group.side]++
      const key = `${group.side}:${sideIndex}`
      const width = axisTextMetrics(
        group.domain,
        nice,
        undefined,
        showUnits ? group.seriesList[0]?.unit : undefined,
        tickCount,
        includeWithoutLastTick,
        measureTextWidth,
        group.maximumTick,
      ).tickTextWidth
      widths.set(key, Math.max(widths.get(key) ?? Y_AXIS_CHARACTER_WIDTH, width))
    })
  })

  const slots: YAxisSlot[] = []
  const clearance = { left: 0, right: 0 }
  ;(['left', 'right'] as const).forEach((side) => {
    const sideIndexes = Array.from(widths.keys())
      .filter((key) => key.startsWith(`${side}:`))
      .map((key) => Number(key.slice(side.length + 1)))
      .sort((first, second) => first - second)
    sideIndexes.forEach((sideIndex) => {
      const tickTextWidth = widths.get(`${side}:${sideIndex}`) ?? Y_AXIS_CHARACTER_WIDTH
      const axisOffset = side === 'left' && clearance.left > 0 ? -clearance.left : clearance[side]
      const labelDistance =
        tickTextWidth + Y_AXIS_TICK_PADDING + Y_AXIS_LABEL_GAP + Y_AXIS_LABEL_BAND_WIDTH / 2
      const labelOffset = axisOffset + labelDistance * (side === 'left' ? -1 : 1)
      const fullClearance =
        tickTextWidth +
        Y_AXIS_TICK_PADDING +
        Y_AXIS_LABEL_GAP +
        Y_AXIS_LABEL_BAND_WIDTH +
        Y_AXIS_OUTER_PADDING
      slots.push({ side, sideIndex, axisOffset, labelOffset, clearance: fullClearance })
      clearance[side] += fullClearance
    })
  })
  return { slots, clearance }
}

type PositionedTrack = Pick<TrackLayout, 'left' | 'top' | 'width' | 'height'>

export function findClosestTrackAtPointer<T extends PositionedTrack>(
  tracks: readonly T[],
  pointerX: number,
  pointerY: number,
): T | undefined {
  const distanceToTrack = (track: T) => {
    const xDistance =
      pointerX < track.left
        ? track.left - pointerX
        : pointerX > track.left + track.width
          ? pointerX - track.left - track.width
          : 0
    return pointerY < track.top
      ? track.top - pointerY
      : pointerY > track.top + track.height
        ? pointerY - (track.top + track.height)
        : xDistance
  }

  let closestTrack = tracks[0]
  if (!closestTrack) return undefined
  let closestDistance = distanceToTrack(closestTrack)
  for (let index = 1; index < tracks.length; index += 1) {
    const candidate = tracks[index]!
    const distance = distanceToTrack(candidate)
    if (distance < closestDistance) {
      closestTrack = candidate
      closestDistance = distance
      continue
    }
    if (distance === closestDistance) {
      const centerDistance = Math.abs(pointerY - (candidate.top + candidate.height / 2))
      const closestCenterDistance = Math.abs(
        pointerY - (closestTrack.top + closestTrack.height / 2),
      )
      if (centerDistance < closestCenterDistance) closestTrack = candidate
    }
  }
  return closestTrack
}

export { buildTrackLayouts, type BuildTrackLayoutsOptions } from './trackLayoutBuilder'

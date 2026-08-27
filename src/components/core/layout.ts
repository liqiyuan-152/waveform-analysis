import { scaleLinear } from 'd3'

import type { WaveformOverlayMode } from '../../types'
import { formatScientificAxisLabel, paddedDomain } from '../../utils'
import type { DisplaySeries, DisplayTrack, TrackLayout } from './types'
import { MAX_MULTI_Y_AXIS_COUNT } from './constants'
import {
  mergeYDomains,
  resolveSeriesFixedYDomain,
  resolveTrackFixedYDomain,
  type WaveformYDomain,
} from './yDomain'

// 导出常量供外部使用
export { MAX_MULTI_Y_AXIS_COUNT } from './constants'

const Y_AXIS_CHARACTER_WIDTH = 7
const Y_AXIS_TICK_PADDING = 7
const Y_AXIS_OUTER_PADDING = 4
const Y_AXIS_LABEL_GAP = 0
const Y_AXIS_LABEL_BAND_WIDTH = 12

export function resolveYAxisTickCount(_plotHeight: number, splitNumber?: number): number {
  if (typeof splitNumber === 'number' && Number.isFinite(splitNumber)) {
    return Math.max(2, Math.floor(splitNumber))
  }
  return 5
}

export interface YAxisSeriesGroup {
  index: number
  side: 'left' | 'right'
  seriesList: DisplaySeries[]
  domain: [number, number]
  fixed: boolean
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

export function axisTextMetrics(
  domain: [number, number],
  nice = true,
  tickValues?: number[],
  unit?: string,
  tickCount = 10,
): { tickTextWidth: number } {
  const effectiveTickCount =
    typeof tickCount === 'number' && Number.isFinite(tickCount)
      ? Math.max(2, Math.floor(tickCount))
      : 10
  const scale = scaleLinear(domain, [1, 0])
  if (nice) scale.nice(effectiveTickCount)
  const [axisMin, axisMax] = scale.domain()
  const values = tickValues ?? scale.ticks(effectiveTickCount)
  const topTickValue = Math.max(...values)
  const maximumTickCharacters = Math.max(
    1,
    ...values.map(
      (value) => formatScientificAxisLabel(value, { axisMin, axisMax, topTickValue, unit }).length,
    ),
  )
  return {
    tickTextWidth: maximumTickCharacters * Y_AXIS_CHARACTER_WIDTH,
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

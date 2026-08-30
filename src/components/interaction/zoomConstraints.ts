import { scaleLinear, zoomIdentity, type ZoomTransform } from 'd3'

import type { WaveformPoint } from '../../types'
import { pointSourceFromPoints, type WaveformPointSource } from '../../core/waveformPointSource'
import { ZOOM_CONSTRAINTS } from '../core/constants'

interface PointSeriesSource {
  points: WaveformPoint[]
  source?: WaveformPointSource
}

export type ZoomSeriesGroup = readonly PointSeriesSource[]

interface ZoomConstraintOptions {
  minZoomSpan?: number
  minVisiblePoints?: number
}

const xValueCache = new WeakMap<object, Map<string, number[]>>()

function normalizedBoundary(boundary: [number, number]): [number, number] {
  return boundary[0] <= boundary[1] ? [...boundary] : [boundary[1], boundary[0]]
}

function resolveRequiredPointCount(minimum: number | undefined): number {
  return Number.isFinite(minimum) && (minimum ?? 0) > 0 ? Math.ceil(minimum as number) : 0
}

function uniqueXValues(group: ZoomSeriesGroup, boundary: [number, number]): number[] {
  const boundaryKey = `${boundary[0]}\u0000${boundary[1]}`
  const cached = xValueCache.get(group)?.get(boundaryKey)
  if (cached) return cached
  const values = new Set<number>()
  for (const series of group) {
    const source = series.source ?? pointSourceFromPoints(series.points)
    for (let index = 0; index < source.length; index += 1) {
      const point = source.pointAt(index)!
      if (point.x >= boundary[0] && point.x <= boundary[1]) values.add(point.x)
    }
  }
  const sorted = Array.from(values).sort((left, right) => left - right)
  const groupCache = xValueCache.get(group) ?? new Map<string, number[]>()
  groupCache.set(boundaryKey, sorted)
  xValueCache.set(group, groupCache)
  return sorted
}

function minimumPointSpan(
  groups: readonly ZoomSeriesGroup[],
  boundary: [number, number],
  required: number,
): number {
  if (required <= 1) return 0
  let minimumSpan = 0
  for (const group of groups) {
    const values = uniqueXValues(group, boundary)
    if (values.length < required) return boundary[1] - boundary[0]
    let groupSpan = Number.POSITIVE_INFINITY
    for (let index = 0; index + required <= values.length; index += 1) {
      groupSpan = Math.min(groupSpan, values[index + required - 1] - values[index])
    }
    const endpointTolerance =
      Number.EPSILON * Math.max(1, Math.abs(boundary[0]), Math.abs(boundary[1])) * 16
    minimumSpan = Math.max(minimumSpan, groupSpan + endpointTolerance)
  }
  return minimumSpan
}

export function resolveMinimumZoomSpan(
  boundary: [number, number],
  groups: readonly ZoomSeriesGroup[],
  options: ZoomConstraintOptions,
): number {
  const normalized = normalizedBoundary(boundary)
  const boundarySpan = normalized[1] - normalized[0]
  if (!Number.isFinite(boundarySpan) || boundarySpan <= 0) return 0
  const configuredSpan =
    Number.isFinite(options.minZoomSpan) && (options.minZoomSpan ?? 0) > 0
      ? Math.min(boundarySpan, options.minZoomSpan as number)
      : 0
  const required = resolveRequiredPointCount(options.minVisiblePoints)
  const pointSpan = minimumPointSpan(groups, normalized, required)
  if (configuredSpan > 0 || required > 0) {
    return Math.max(configuredSpan, pointSpan)
  }
  return boundarySpan / ZOOM_CONSTRAINTS.DEFAULT_MAX_SCALE
}

function expandToMinimumPoints(
  domain: [number, number],
  boundary: [number, number],
  groups: readonly ZoomSeriesGroup[],
  required: number,
): [number, number] {
  if (required <= 0) return domain
  const endpointTolerance =
    Number.EPSILON * Math.max(1, Math.abs(boundary[0]), Math.abs(boundary[1])) * 16
  let expanded = domain
  for (const group of groups) {
    const values = uniqueXValues(group, boundary)
    if (values.length < required) return [...boundary]
    const visibleCount = values.filter(
      (value) => value >= expanded[0] && value <= expanded[1],
    ).length
    if (visibleCount >= required) continue
    let best: [number, number] | undefined
    let bestSpan = Number.POSITIVE_INFINITY
    let bestCenterDistance = Number.POSITIVE_INFINITY
    const requestedCenter = (expanded[0] + expanded[1]) / 2
    for (let index = 0; index + required <= values.length; index += 1) {
      const candidate: [number, number] = [
        Math.max(boundary[0], Math.min(expanded[0], values[index] - endpointTolerance)),
        Math.min(
          boundary[1],
          Math.max(expanded[1], values[index + required - 1] + endpointTolerance),
        ),
      ]
      const span = candidate[1] - candidate[0]
      const centerDistance = Math.abs((candidate[0] + candidate[1]) / 2 - requestedCenter)
      if (span < bestSpan || (span === bestSpan && centerDistance < bestCenterDistance)) {
        best = candidate
        bestSpan = span
        bestCenterDistance = centerDistance
      }
    }
    expanded = best ?? [...boundary]
  }
  return expanded
}

export function constrainZoomDomain(
  domain: [number, number],
  boundary: [number, number],
  groups: readonly ZoomSeriesGroup[],
  options: ZoomConstraintOptions,
): [number, number] {
  const normalized = normalizedBoundary(boundary)
  const boundarySpan = normalized[1] - normalized[0]
  if (!Number.isFinite(boundarySpan) || boundarySpan <= 0) return normalized
  if (Math.abs(domain[1] - domain[0]) >= boundarySpan * (1 - 1e-12)) return normalized
  const requested: [number, number] = [
    Math.max(normalized[0], Math.min(domain[0], domain[1])),
    Math.min(normalized[1], Math.max(domain[0], domain[1])),
  ]
  const expanded = expandToMinimumPoints(
    requested,
    normalized,
    groups,
    resolveRequiredPointCount(options.minVisiblePoints),
  )
  const minimumSpan = resolveMinimumZoomSpan(normalized, groups, options)
  const span = Math.max(minimumSpan, Math.min(boundarySpan, expanded[1] - expanded[0]))
  const center = (expanded[0] + expanded[1]) / 2
  const start = Math.max(normalized[0], Math.min(center - span / 2, normalized[1] - span))
  return [start, start + span]
}

export function transformForDomain(
  domain: [number, number],
  baseDomain: [number, number],
  width: number,
): ZoomTransform {
  const baseSpan = baseDomain[1] - baseDomain[0]
  const span = domain[1] - domain[0]
  if (!Number.isFinite(baseSpan) || !Number.isFinite(span) || baseSpan <= 0 || span <= 0) {
    return zoomIdentity
  }
  const scale = baseSpan / span
  const baseScale = scaleLinear(baseDomain, [0, width])
  return zoomIdentity.translate(-scale * baseScale(domain[0]), 0).scale(scale)
}

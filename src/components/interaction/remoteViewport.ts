import type { ResolvedWaveformChartProps } from '../core/waveformChartTypes'
import {
  constrainZoomDomain,
  resolveMinimumZoomSpan,
  type ZoomSeriesGroup,
} from './zoomConstraints'

export function clampViewportDomain(
  domain: [number, number],
  boundary: [number, number],
): [number, number] {
  const span = domain[1] - domain[0]
  const boundarySpan = boundary[1] - boundary[0]
  if (span >= boundarySpan) return [...boundary]
  if (domain[0] < boundary[0]) return [boundary[0], boundary[0] + span]
  if (domain[1] > boundary[1]) return [boundary[1] - span, boundary[1]]
  return domain
}

export function remotePanBoundary(props: Pick<ResolvedWaveformChartProps, 'panXDomain'>) {
  const domain = props.panXDomain
  return domain && domain.every(Number.isFinite) && domain[0] < domain[1] ? domain : undefined
}

/** Restore remote windows without requiring points inside a not-yet-loaded interval. */
export function restoreViewportDomain(
  domain: [number, number],
  baseDomain: [number, number],
  groups: readonly ZoomSeriesGroup[],
  props: ResolvedWaveformChartProps,
): [number, number] {
  const boundary = remotePanBoundary(props)
  return boundary
    ? clampViewportDomain(domain, boundary)
    : constrainZoomDomain(domain, baseDomain, groups, props)
}

/** Wheel/box zoom keeps the remote position and uses loaded data for scale limits. */
export function constrainViewportZoom(
  domain: [number, number],
  baseDomain: [number, number],
  groups: readonly ZoomSeriesGroup[],
  props: ResolvedWaveformChartProps,
) {
  const boundary = remotePanBoundary(props)
  if (!boundary) return constrainZoomDomain(domain, baseDomain, groups, props)
  return constrainZoomDomain(domain, boundary, [], {
    ...props,
    minVisiblePoints: 0,
    maxZoomScale: null,
    minZoomSpan: resolveMinimumZoomSpan(baseDomain, groups, props),
  })
}

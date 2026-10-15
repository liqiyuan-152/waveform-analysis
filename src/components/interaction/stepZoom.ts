import type { ResolvedWaveformChartProps } from '../core/waveformChartTypes'
import { normalizeIntegerZoomDomain } from './integerZoom'
import { constrainViewportZoom } from './remoteViewport'
import type { ZoomSeriesGroup } from './zoomConstraints'

export const sameZoomDomain = (a: [number, number], b: [number, number]) =>
  a.every((value, index) => Math.abs(value - b[index]!) < 1e-12)

/** Toolbar and wheel steps share their scale factor and constraints. */
export function resolveStepZoomDomain(
  current: [number, number],
  action: 'zoom-in' | 'zoom-out',
  boundary: [number, number],
  groups: readonly ZoomSeriesGroup[],
  props: ResolvedWaveformChartProps,
  anchorRatio = 0.5,
): [number, number] {
  const [start, end] = current
  const ratio = Math.max(0, Math.min(1, anchorRatio))
  const anchor = start + (end - start) * ratio
  const span = (end - start) * (action === 'zoom-in' ? 0.5 : 2)
  const requested = normalizeIntegerZoomDomain(
    [anchor - span * ratio, anchor + span * (1 - ratio)],
    props,
  )
  let constrained = constrainViewportZoom(requested, boundary, groups, props)
  // Outward integer rounding can map a 3 ms window's 1.5 ms step back to
  // the same window. Allow fractional endpoints when snapping prevents progress,
  // while retaining point, span, scale and remote boundary constraints.
  if (
    action === 'zoom-in' &&
    props.integerZoom &&
    constrained[1] - constrained[0] >= end - start - 1e-12
  ) {
    constrained = constrainViewportZoom(requested, boundary, groups, {
      ...props,
      integerZoom: false,
    })
  }
  // An unsatisfiable point constraint may expand to the entire boundary.
  // A zoom-in step must not turn into a zoom-out operation.
  return action === 'zoom-in' && constrained[1] - constrained[0] > end - start
    ? [...current]
    : constrained
}

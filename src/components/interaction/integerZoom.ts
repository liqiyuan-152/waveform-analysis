import { scaleLinear } from 'd3'

export interface IntegerZoomOptions {
  integerZoom?: boolean
  timeUnit?: 's' | 'ms'
}

export function integerZoomTicks(
  domain: [number, number],
  count: number,
  options: IntegerZoomOptions,
) {
  if (!options.integerZoom) return scaleLinear().domain(domain).ticks(count)
  const factor = options.timeUnit === 's' ? 1 : 1000
  return scaleLinear()
    .domain(domain.map((value) => value * factor))
    .ticks(count)
    .filter(Number.isInteger)
    .map((value) => value / factor)
}

export function formatIntegerZoomLabel(value: number): string {
  return String(Math.round(value))
}

function stableInteger(value: number): number {
  const rounded = Math.round(value)
  return Math.abs(value - rounded) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 16
    ? rounded
    : value
}

/** Align outwards in display units; all returned coordinates remain in seconds. */
export function alignIntegerZoomDomain(
  domain: [number, number],
  options: IntegerZoomOptions,
): [number, number] {
  if (!options.integerZoom) return domain
  const factor = options.timeUnit === 's' ? 1 : 1000
  const start = stableInteger(domain[0] * factor)
  const end = stableInteger(domain[1] * factor)
  if (!Number.isSafeInteger(Math.floor(start)) || !Number.isSafeInteger(Math.ceil(end)))
    return domain
  const left = Math.floor(start)
  return [left / factor, Math.max(left + 1, Math.ceil(end)) / factor]
}

/** Recover aligned endpoints after a D3 transform, tolerating floating-point round-off. */
export function normalizeIntegerZoomDomain(
  domain: [number, number],
  options: IntegerZoomOptions,
): [number, number] {
  return alignIntegerZoomDomain(domain, options)
}

/** Translation snaps to the nearest unit so panning preserves the visible span. */
export function alignIntegerPanDomain(
  domain: [number, number],
  options: IntegerZoomOptions,
): [number, number] {
  if (!options.integerZoom) return domain
  const factor = options.timeUnit === 's' ? 1 : 1000
  return [Math.round(domain[0] * factor) / factor, Math.round(domain[1] * factor) / factor]
}

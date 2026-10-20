import { resolveXAxisTicks } from '../core/xAxisTicks'
import { formatPlainNumber } from '../../utils/formatters'

export interface IntegerZoomOptions {
  integerZoom?: boolean
  timeUnit?: 's' | 'ms'
}

export function integerZoomTicks(
  domain: [number, number],
  count: number,
  options: IntegerZoomOptions,
) {
  if (!options.integerZoom) return resolveXAxisTicks(domain, count)
  const factor = options.timeUnit === 's' ? 1 : 1000
  const fractional = hasFractionalZoomDomain(domain, options)
  return resolveXAxisTicks(
    domain.map((value) => value * factor) as [number, number],
    count,
    fractional ? 0 : 1,
  )
    .filter((value) => fractional || Number.isInteger(value))
    .map((value) => value / factor)
}

export function formatIntegerZoomLabel(value: number): string {
  return formatPlainNumber(Number(stableInteger(value).toPrecision(15)))
}

function stableInteger(value: number, factor = 1): number {
  const rounded = Math.round(value)
  return Math.abs(value - rounded) <= Number.EPSILON * Math.max(factor, Math.abs(value)) * 32
    ? rounded
    : value
}

function displayDomain(domain: [number, number], options: IntegerZoomOptions): [number, number] {
  const factor = options.timeUnit === 's' ? 1 : 1000
  return [stableInteger(domain[0] * factor, factor), stableInteger(domain[1] * factor, factor)]
}

/** Fractional viewports, including those panned across an integer, need decimal ticks. */
function hasFractionalZoomDomain(domain: [number, number], options: IntegerZoomOptions): boolean {
  return displayDomain(domain, options).some((value) => !Number.isInteger(value))
}

/** Align outwards only when the displayed span reaches one unit. */
export function alignIntegerZoomDomain(
  domain: [number, number],
  options: IntegerZoomOptions,
): [number, number] {
  if (!options.integerZoom) return domain
  const factor = options.timeUnit === 's' ? 1 : 1000
  const start = stableInteger(Math.min(domain[0], domain[1]) * factor, factor)
  const end = stableInteger(Math.max(domain[0], domain[1]) * factor, factor)
  if (!Number.isSafeInteger(Math.floor(start)) || !Number.isSafeInteger(Math.ceil(end)))
    return domain
  if (end > start && end - start < 1) return [start / factor, end / factor]
  const left = Math.floor(start)
  return [left / factor, Math.max(left + 1, Math.ceil(end)) / factor]
}

/** Recover endpoints after a D3 transform without applying a new zoom or changing pan span. */
export function normalizeIntegerZoomDomain(
  domain: [number, number],
  options: IntegerZoomOptions,
): [number, number] {
  if (!options.integerZoom) return domain
  const factor = options.timeUnit === 's' ? 1 : 1000
  return displayDomain(domain, options).map((value) => value / factor) as [number, number]
}

/** Integer viewports snap translation; sub-unit viewports pan freely across integers. */
export function alignIntegerPanDomain(
  domain: [number, number],
  options: IntegerZoomOptions,
): [number, number] {
  if (!options.integerZoom) return domain
  const factor = options.timeUnit === 's' ? 1 : 1000
  if (Math.abs(domain[1] - domain[0]) * factor < 1) return domain
  const start = Math.round(domain[0] * factor) / factor
  return [start, start + (domain[1] - domain[0])]
}

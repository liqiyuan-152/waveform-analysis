import * as d3 from 'd3'
import type { XAxisOptions } from '../types/options.js'

const MIN_TICK_SPACING = 48
const MAX_TICK_COUNT = 100

export function formatXAxisTick(axis: XAxisOptions, value: d3.NumberValue): string {
  const number = Number(value)
  if (typeof axis.tickFormat === 'function') return axis.tickFormat(number)
  if (axis.tickFormat) return d3.format(axis.tickFormat)(number)
  return `${number}${axis.unit ? ` ${axis.unit}` : ''}`
}

export function estimateXAxisLabelWidth(label: string, fontSize: number): number {
  return Math.max(...label.split('\n').map((line) => line.length * fontSize * 0.6))
}

function tickCapacity(innerWidth: number, spacing: number): number {
  if (!Number.isFinite(innerWidth) || innerWidth <= 0) return 2
  return Math.max(2, Math.min(MAX_TICK_COUNT, Math.floor(innerWidth / spacing)))
}

function niceIntegerMultiple(ratio: number): number {
  if (!Number.isFinite(ratio)) return Number.POSITIVE_INFINITY
  if (ratio <= 1) return 1
  const power = 10 ** Math.floor(Math.log10(ratio))
  const fraction = ratio / power
  const factor = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return factor * power
}

function effectiveStep(requestedStep: number, span: number, capacity: number): number {
  const maxIntervals = Math.max(1, capacity - 1)
  const ratio = span / requestedStep / maxIntervals
  const multiple = niceIntegerMultiple(ratio)
  const resolved = requestedStep * multiple
  return Number.isFinite(resolved) && resolved > 0 ? resolved : span / maxIntervals
}

function alignedTickValues(domain: [number, number], step: number): number[] {
  const low = Math.min(...domain)
  const high = Math.max(...domain)
  const span = high - low
  if (!Number.isFinite(step) || step <= 0 || step > span) return []

  const tolerance = Math.abs(step) * 1e-12
  const firstIndex = Math.ceil((low - tolerance) / step)
  const lastIndex = Math.floor((high + tolerance) / step)
  const count = Math.max(0, lastIndex - firstIndex + 1)
  return Array.from({ length: Math.min(count, MAX_TICK_COUNT) }, (_, offset) => {
    const value = (firstIndex + offset) * step
    return value === 0 ? 0 : Number(value.toPrecision(15))
  })
}

export function resolveXAxisTickValues(
  scale: d3.ScaleLinear<number, number>,
  axis: XAxisOptions,
  innerWidth: number,
): number[] {
  const requestedStep = axis.tickStep
  if (!Number.isFinite(requestedStep) || (requestedStep ?? 0) <= 0) {
    return scale.ticks(axis.tickCount ?? 8)
  }

  const domain = scale.domain() as [number, number]
  const span = Math.abs(domain[1] - domain[0])
  if (!Number.isFinite(span) || span <= 0 || requestedStep! > span) return []

  let capacity = tickCapacity(innerWidth, MIN_TICK_SPACING)
  let step = effectiveStep(requestedStep!, span, capacity)
  let values = alignedTickValues(domain, step)

  const fontSize = axis.fontSize ?? 11
  const tickPadding = axis.tickPadding ?? 6
  const labels = [...values, ...domain].map((value) => formatXAxisTick(axis, value))
  const widestLabel = Math.max(
    0,
    ...labels.map((label) => estimateXAxisLabelWidth(label, fontSize)),
  )
  const refinedSpacing = Math.max(MIN_TICK_SPACING, widestLabel + 2 * tickPadding)
  const refinedCapacity = tickCapacity(innerWidth, refinedSpacing)
  if (refinedCapacity < capacity) {
    capacity = refinedCapacity
    step = effectiveStep(requestedStep!, span, capacity)
    values = alignedTickValues(domain, step)
  }

  return values
}

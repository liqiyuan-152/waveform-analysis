import { niceCoefficient } from '../../shared/axis/numeric'
import { scaleLinear } from 'd3'
import { decimalPrecision } from '../../utils/numericPrecision'

const MAX_TICK_COUNT = 3000

/** ECharts-style numeric ticks inside the viewport; never expands its domain. */
export function resolveXAxisTicks(
  domain: readonly [number, number],
  splitNumber: number,
  minInterval = 0,
): number[] {
  const [start, end] = domain
  if (!Number.isFinite(start) || !Number.isFinite(end)) return []
  if (start === end) return normalizeTicks([start], start, end)
  if (start > end) return resolveXAxisTicks([end, start], splitNumber, minInterval).reverse()

  const count = Number.isFinite(splitNumber) ? Math.max(1, Math.round(splitNumber)) : 5
  const roughInterval = (end - start) / count
  const exponent = Math.floor(Math.log10(roughInterval))
  const power = 10 ** exponent
  const fraction = roughInterval / power
  const coefficient = niceCoefficient(fraction, '1235')
  const interval = Math.max(coefficient * power, minInterval)
  const precision = decimalPrecision(interval) + 2
  const fallback = () => fallbackTicks(start, end, count)

  // Extreme magnitudes may exceed decimal rounding or safe integer index precision.
  if (!Number.isFinite(interval) || interval <= 0 || precision > 100) return fallback()
  const first = Math.ceil(snapTickIndex(start / interval))
  const last = Math.floor(snapTickIndex(end / interval))
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return fallback()
  if (last - first + 1 > MAX_TICK_COUNT) return fallback()

  const ticks: number[] = []
  for (let index = first; index <= last; index++) {
    const value = Number((index * interval).toFixed(precision))
    if (ticks.length && value <= ticks[ticks.length - 1]!) return fallback()
    ticks.push(value)
  }
  return normalizeTicks(ticks, start, end)
}

function fallbackTicks(start: number, end: number, count: number): number[] {
  const scale = scaleLinear().domain([start, end])
  let targetCount = Math.min(count, MAX_TICK_COUNT)
  while (true) {
    const ticks = normalizeTicks(scale.ticks(targetCount), start, end)
    if (ticks.length <= MAX_TICK_COUNT) return ticks
    // D3 treats count as a hint. Regenerate with a wider interval instead of truncating.
    targetCount = Math.max(1, Math.floor(targetCount / 2))
  }
}

function normalizeTicks(values: number[], start: number, end: number): number[] {
  return [
    ...new Set(
      values
        .filter((value) => Number.isFinite(value) && value >= start && value <= end)
        .map((value) => (value === 0 ? 0 : value)),
    ),
  ].sort((a, b) => a - b)
}

function snapTickIndex(value: number): number {
  const rounded = Math.round(value)
  return Math.abs(value - rounded) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 4
    ? rounded
    : value
}

import { scaleLinear, tickStep } from 'd3'

import type { WaveformXDomainStrategy } from '../../types'

const DEFAULT_NICE_TICK_COUNT = 10
const MILLISECONDS_PER_SECOND = 1000
const MIN_TEN_MULTIPLE_SPAN_MS = 100

function resolveTickCount(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) < 1) return DEFAULT_NICE_TICK_COUNT
  return Math.max(1, Math.trunc(value as number))
}

/** Derives a viewport domain without changing any source coordinates. */
export function applyXDomainStrategy(
  domain: [number, number],
  strategy: WaveformXDomainStrategy,
  explicit = false,
): [number, number] {
  if (explicit && !strategy.includeExplicit) return [...domain]

  if (strategy.type === 'integer-ms') {
    const start = domain[0] * MILLISECONDS_PER_SECOND
    const end = domain[1] * MILLISECONDS_PER_SECOND
    if (
      !Number.isSafeInteger(Math.ceil(Math.abs(start))) ||
      !Number.isSafeInteger(Math.ceil(Math.abs(end))) ||
      end - start < 1
    ) {
      return [...domain]
    }
    const step =
      end - start >= MIN_TEN_MULTIPLE_SPAN_MS
        ? Math.max(10, tickStep(start, end, DEFAULT_NICE_TICK_COUNT) / 10)
        : 1
    return [
      (Math.floor(start / step) * step) / MILLISECONDS_PER_SECOND,
      (Math.ceil(end / step) * step) / MILLISECONDS_PER_SECOND,
    ]
  }

  if (strategy.type !== 'nice') return [...domain]

  const niceDomain = scaleLinear()
    .domain(domain)
    .nice(resolveTickCount(strategy.tickCount))
    .domain() as [number, number]
  return strategy.bounds === 'end' ? [domain[0], niceDomain[1]] : niceDomain
}

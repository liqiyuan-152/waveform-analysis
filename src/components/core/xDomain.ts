import { scaleLinear } from 'd3'

import type { WaveformXDomainStrategy } from '../../types'

const DEFAULT_NICE_TICK_COUNT = 10

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
  if (strategy.type !== 'nice' || (explicit && !strategy.includeExplicit)) return [...domain]

  const niceDomain = scaleLinear()
    .domain(domain)
    .nice(resolveTickCount(strategy.tickCount))
    .domain() as [number, number]
  return strategy.bounds === 'end' ? [domain[0], niceDomain[1]] : niceDomain
}

import type { DisplaySeries, DisplayTrack } from './types'

export type WaveformYDomain = [number, number]

export function normalizeYDomain(
  domain: readonly [number, number] | undefined,
): WaveformYDomain | undefined {
  if (
    !domain ||
    !Number.isFinite(domain[0]) ||
    !Number.isFinite(domain[1]) ||
    domain[0] === domain[1]
  ) {
    return undefined
  }
  return domain[0] < domain[1] ? [domain[0], domain[1]] : [domain[1], domain[0]]
}

export function resolveTrackFixedYDomain(
  track: Pick<DisplayTrack, 'id'>,
  yDomains?: Record<string, WaveformYDomain>,
): WaveformYDomain | undefined {
  return normalizeYDomain(yDomains?.[track.id])
}

export function resolveSeriesFixedYDomain(
  series: Pick<DisplaySeries, 'id'>,
  yDomain?: WaveformYDomain,
  yDomains?: Record<string, WaveformYDomain>,
): WaveformYDomain | undefined {
  return normalizeYDomain(yDomains?.[series.id]) ?? normalizeYDomain(yDomain)
}

export function hasFixedYDomainForTrack(
  track: Pick<DisplayTrack, 'id' | 'visibleSeries'>,
  yDomain?: WaveformYDomain,
  yDomains?: Record<string, WaveformYDomain>,
): boolean {
  return Boolean(
    resolveTrackFixedYDomain(track, yDomains) ||
    track.visibleSeries.some((series) => resolveSeriesFixedYDomain(series, yDomain, yDomains)),
  )
}

export function mergeYDomains(domains: readonly WaveformYDomain[]): WaveformYDomain {
  return [
    Math.min(...domains.map((domain) => domain[0])),
    Math.max(...domains.map((domain) => domain[1])),
  ]
}

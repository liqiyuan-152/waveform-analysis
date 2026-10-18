import type { WaveformSeries } from '../../types/data.js'

export interface SeriesMatch {
  previous?: WaveformSeries
  target?: WaveformSeries
}

/** Input order is already normalized; preserve it for target drawing order. */
export function diffSeries(
  previous: readonly WaveformSeries[],
  target: readonly WaveformSeries[],
): SeriesMatch[] | undefined {
  if (
    previous.length === 1 &&
    target.length === 1 &&
    !previous[0].id?.trim() &&
    !target[0].id?.trim()
  ) {
    return [{ previous: previous[0], target: target[0] }]
  }
  const old = new Map<string, WaveformSeries>()
  for (const series of previous) {
    const id = series.id?.trim()
    if (!id || old.has(id)) return undefined
    old.set(id, series)
  }
  const seen = new Set<string>()
  const matches: SeriesMatch[] = []
  for (const series of target) {
    const id = series.id?.trim()
    if (!id || seen.has(id)) return undefined
    seen.add(id)
    matches.push({ previous: old.get(id), target: series })
  }
  for (const [id, series] of old) if (!seen.has(id)) matches.push({ previous: series })
  return matches
}

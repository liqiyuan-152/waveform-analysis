import type { DisplaySeries, TrackLayout } from '../components/core/types'
import { pointSourceFromPoints } from '../core/waveformPointSource'

/** Hover clamps to endpoints, unlike the strict range query exposed by the data service. */
export function nearestHoverPoint(series: DisplaySeries, x: number) {
  const source = series.source ?? pointSourceFromPoints(series.points)
  const first = source.pointAt(0)
  const last = source.pointAt(source.length - 1)
  if (!first || !last) return undefined
  if (x <= first.x) return first
  if (x >= last.x) return last
  return source.nearestPoint(x)
}

export function crosshairXForTrack(track: TrackLayout, x: number) {
  let range: [number, number] | undefined
  let longest = -Infinity
  for (const series of track.seriesList) {
    const source = series.source ?? pointSourceFromPoints(series.points)
    const first = source.pointAt(0)
    const last = source.pointAt(source.length - 1)
    if (!first || !last || last.x - first.x <= longest) continue
    longest = last.x - first.x
    range = [first.x, last.x]
  }
  return range ? Math.max(range[0], Math.min(range[1], x)) : undefined
}

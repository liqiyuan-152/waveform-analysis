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
  let nearestX: number | undefined
  let minimumDistance = Infinity
  for (const series of track.seriesList) {
    const point = nearestHoverPoint(series, x)
    if (!point) continue
    const distance = Math.abs(point.x - x)
    // Match nearestPoint's right-hand tie break, regardless of series order.
    if (distance < minimumDistance || (distance === minimumDistance && point.x > nearestX!)) {
      minimumDistance = distance
      nearestX = point.x
    }
  }
  return nearestX
}

import type { WaveformData, WaveformPoint, WaveformSeries } from '../types/data.js'
import { snapshot } from '../config/snapshot.js'

function isPoint(value: WaveformPoint | WaveformSeries): value is WaveformPoint {
  return 'x' in value && 'y' in value
}

function sanitizePoints(points: WaveformPoint[]): WaveformPoint[] {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) =>
      point.id === undefined
        ? { x: point.x, y: point.y }
        : { id: point.id, x: point.x, y: point.y },
    )
}

export function normalizeData(data: WaveformData): WaveformSeries[] {
  if (!data.length) return []

  if (isPoint(data[0] as WaveformPoint | WaveformSeries)) {
    return [{ id: 'series-0', order: 0, data: sanitizePoints(data as WaveformPoint[]) }]
  }

  return (data as WaveformSeries[])
    .map((series, index) => ({
      ...snapshot({ ...series, data: undefined }),
      order: series.order ?? index,
      data: sanitizePoints(series.data),
    }))
    .filter((series) => series.data.length > 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

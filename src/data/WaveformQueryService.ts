import type { WaveformDataManager } from './WaveformDataManager'
import type { WaveformPoint } from '../types/chart'

/** Queries always use full normalized sources, independently of display sampling. */
export class WaveformQueryService {
  constructor(private readonly data: WaveformDataManager) {}

  nearestPoint(seriesId: string, x: number): WaveformPoint | undefined {
    const source = this.data.series.find((series) => series.id === seriesId)?.source
    const first = source?.pointAt(0)
    const last = source?.pointAt((source?.length ?? 0) - 1)
    if (!first || !last || !Number.isFinite(x) || x < first.x || x > last.x) return undefined
    const point = source!.nearestPoint(x)
    return point ? { ...point } : undefined
  }

  pointsInDomain(seriesId: string, domain: [number, number]): WaveformPoint[] {
    if (!domain.every(Number.isFinite)) return []
    const source = this.data.series.find((series) => series.id === seriesId)?.source
    if (!source) return []
    const range = source.visibleRange(domain)
    return source.pointsInRange(range.start, range.end).map((point) => ({ ...point }))
  }

  metrics(seriesId: string, includeErrors = false) {
    return this.data.series.find((series) => series.id === seriesId)?.source.metrics(includeErrors)
  }
}

import type {
  SingleWaveformData,
  WaveformData,
  WaveformPoint,
  NormalizedWaveformSeries,
} from '../types'

/**
 * 规范化单波形数据
 * @param data 输入数据（samples 或 points 格式）
 * @returns 规范化后的点数组
 */
export function normalizeWaveformData(data: SingleWaveformData): WaveformPoint[] {
  if (data.kind === 'samples') {
    if (!Number.isFinite(data.sampleRate) || data.sampleRate <= 0) return []

    const startTime = Number.isFinite(data.startTime) ? (data.startTime ?? 0) : 0
    return data.values.flatMap((value, index) =>
      Number.isFinite(value) ? [{ x: startTime + index / data.sampleRate, y: value }] : [],
    )
  }

  return data.points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ ...point }))
    .sort((left, right) => left.x - right.x)
}

/**
 * 规范化波形系列数据
 * @param data 输入数据（单波形或多通道）
 * @returns 规范化后的系列数组
 */
export function normalizeWaveformSeries(data: WaveformData): NormalizedWaveformSeries[] {
  if (data.kind !== 'series') {
    const points = normalizeWaveformData(data)
    return points.length > 0 ? [{ id: 'series-0', name: '', points }] : []
  }

  const usedIds = new Set<string>()

  return data.series
    .map((series, index) => {
      const id = series.id?.trim() || `series-${index}`

      // 确保 ID 唯一，如果重复则添加后缀
      let uniqueId = id
      let suffix = 1
      while (usedIds.has(uniqueId)) {
        uniqueId = `${id}-${suffix}`
        suffix++
      }
      usedIds.add(uniqueId)

      return {
        id: uniqueId,
        trackId: series.trackId?.trim() || undefined,
        name: series.name,
        unit: series.unit,
        color: series.color,
        points: normalizeWaveformData(series.data),
      }
    })
    .filter((series) => series.points.length > 0)
}

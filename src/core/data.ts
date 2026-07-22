import type {
  SingleWaveformData,
  WaveformData,
  WaveformPoint,
  WaveformLineStyle,
  NormalizedWaveformSeries,
} from '../types'
import { ERROR_BAR_DEFAULTS } from '../components/core/constants'

const DEFAULT_ERROR_BAR_WIDTH = ERROR_BAR_DEFAULTS.WIDTH
const DEFAULT_ERROR_BAR_CAP_WIDTH = ERROR_BAR_DEFAULTS.CAP_WIDTH

function normalizeLineStyle(value: unknown): WaveformLineStyle {
  return value === 'dashed' || value === 'dash-dot' ? value : 'solid'
}

function normalizeError(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function normalizeWaveformPoint(point: WaveformPoint): WaveformPoint {
  const error = normalizeError(point.error)
  const lowerError = normalizeError(point.lowerError)
  const upperError = normalizeError(point.upperError)
  return {
    x: point.x,
    y: point.y,
    ...(error === undefined ? {} : { error }),
    ...(lowerError === undefined ? {} : { lowerError }),
    ...(upperError === undefined ? {} : { upperError }),
  }
}

export function resolveWaveformPointErrors(point: WaveformPoint): {
  lower: number
  upper: number
} {
  const symmetric = normalizeError(point.error) ?? 0
  return {
    lower: normalizeError(point.lowerError) ?? symmetric,
    upper: normalizeError(point.upperError) ?? symmetric,
  }
}

/**
 * 规范化单波形数据
 * @param data 输入数据（samples 或 points 格式）
 * @returns 规范化后的点数组
 */
export function normalizeWaveformData(data: SingleWaveformData): WaveformPoint[] {
  if (data.kind === 'samples') {
    if (!Number.isFinite(data.sampleRate) || data.sampleRate <= 0) return []

    const startTime = Number.isFinite(data.startTime) ? (data.startTime ?? 0) : 0
    const points: WaveformPoint[] = []
    for (let index = 0; index < data.values.length; index += 1) {
      const value = data.values[index]
      if (!Number.isFinite(value)) continue
      points.push({ x: startTime + index / data.sampleRate, y: value })
    }

    return points
  }

  const points: WaveformPoint[] = []
  let previousX = Number.NEGATIVE_INFINITY
  let sorted = true
  for (const point of data.points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    const normalized = normalizeWaveformPoint(point)
    if (normalized.x < previousX) sorted = false
    previousX = normalized.x
    points.push(normalized)
  }
  if (!sorted) points.sort((left, right) => left.x - right.x)

  return points
}

/**
 * 规范化波形系列数据
 * @param data 输入数据（单波形或多通道）
 * @returns 规范化后的系列数组
 */
export function normalizeWaveformSeries(data: WaveformData): NormalizedWaveformSeries[] {
  if (data.kind !== 'series') {
    const points = normalizeWaveformData(data)
    return points.length > 0
      ? [
          {
            id: 'series-0',
            name: '',
            lineType: 'linear',
            lineStyle: 'solid',
            pointType: 'none',
            errorBar: {
              visible: false,
              width: DEFAULT_ERROR_BAR_WIDTH,
              capWidth: DEFAULT_ERROR_BAR_CAP_WIDTH,
            },
            points,
          },
        ]
      : []
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

      const requestedLineType = series.lineType ?? 'linear'
      const lineStyle = normalizeLineStyle((series as { lineStyle?: unknown }).lineStyle)
      const requestedPointType = series.pointType ?? 'none'
      const errorBarVisible = series.errorBar?.visible === true
      const lineType =
        requestedLineType === 'none' && requestedPointType === 'none' && !errorBarVisible
          ? 'linear'
          : requestedLineType
      const width = Number(series.errorBar?.width)
      const capWidth = Number(series.errorBar?.capWidth)

      return {
        id: uniqueId,
        trackId: series.trackId?.trim() || undefined,
        name: series.name,
        unit: series.unit,
        color: series.color,
        lineType,
        lineStyle,
        pointType: requestedPointType,
        errorBar: {
          visible: errorBarVisible,
          color: series.errorBar?.color,
          width: Number.isFinite(width) && width > 0 ? width : DEFAULT_ERROR_BAR_WIDTH,
          capWidth:
            Number.isFinite(capWidth) && capWidth > 0 ? capWidth : DEFAULT_ERROR_BAR_CAP_WIDTH,
        },
        points: normalizeWaveformData(series.data),
      }
    })
    .filter((series) => series.points.length > 0)
}

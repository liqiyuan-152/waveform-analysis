import type {
  SingleWaveformData,
  WaveformData,
  WaveformPoint,
  WaveformLineStyle,
  NormalizedWaveformSeries,
  WaveformTypedValues,
} from '../types'
import { ERROR_BAR_DEFAULTS } from '../components/core/constants'
import { createWaveformPointSource, type WaveformPointSource } from './waveformPointSource'

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

function isWaveformTypedValues(value: unknown): value is WaveformTypedValues {
  return value instanceof Float32Array || value instanceof Float64Array
}

function normalizeSampleValues(
  values: ArrayLike<number>,
  sampleRate: number,
  startTime: number | undefined,
): WaveformPoint[] {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return []

  const normalizedStartTime = Number.isFinite(startTime) ? (startTime ?? 0) : 0
  const points: WaveformPoint[] = []
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) continue
    points.push({ x: normalizedStartTime + index / sampleRate, y: value })
  }
  return points
}

function normalizeTypedSamples(data: {
  values: unknown
  sampleRate: number
  startTime?: number
}): WaveformPoint[] {
  if (
    !isWaveformTypedValues(data.values) ||
    !Number.isFinite(data.sampleRate) ||
    data.sampleRate <= 0 ||
    (data.startTime !== undefined && !Number.isFinite(data.startTime))
  ) {
    return []
  }
  return normalizeSampleValues(data.values, data.sampleRate, data.startTime)
}

function typedPointValuesHaveMatchingLengths(data: {
  x: unknown
  y: unknown
  error?: unknown
  lowerError?: unknown
  upperError?: unknown
}): data is {
  x: Float64Array
  y: WaveformTypedValues
  error?: WaveformTypedValues
  lowerError?: WaveformTypedValues
  upperError?: WaveformTypedValues
} {
  if (!(data.x instanceof Float64Array) || !isWaveformTypedValues(data.y)) return false
  const length = data.x.length
  const values = [data.error, data.lowerError, data.upperError]
  return (
    values.every(
      (value) => value === undefined || (isWaveformTypedValues(value) && value.length === length),
    ) && data.y.length === length
  )
}

function normalizeTypedPoints(data: {
  x: Float64Array
  y: WaveformTypedValues
  error?: WaveformTypedValues
  lowerError?: WaveformTypedValues
  upperError?: WaveformTypedValues
}): WaveformPoint[] {
  const points: WaveformPoint[] = []
  let previousX = Number.NEGATIVE_INFINITY
  let sorted = true
  for (let index = 0; index < data.x.length; index += 1) {
    const x = data.x[index]
    const y = data.y[index]
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const normalized = normalizeWaveformPoint({
      x,
      y,
      error: data.error?.[index],
      lowerError: data.lowerError?.[index],
      upperError: data.upperError?.[index],
    })
    if (normalized.x < previousX) sorted = false
    previousX = normalized.x
    points.push(normalized)
  }
  if (!sorted) points.sort((left, right) => left.x - right.x)
  return points
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
 * @param data 输入数据（对象数组或 TypedArray 格式）
 * @returns 规范化后的点数组
 */
export function normalizeWaveformData(data: SingleWaveformData): WaveformPoint[] {
  if (data.kind === 'samples') {
    return normalizeSampleValues(data.values, data.sampleRate, data.startTime)
  }

  if (data.kind === 'typed-samples') {
    return normalizeTypedSamples(data)
  }

  if (data.kind === 'typed-points')
    return typedPointValuesHaveMatchingLengths(data) ? normalizeTypedPoints(data) : []

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

export interface NormalizedWaveformSourceSeries extends Omit<NormalizedWaveformSeries, 'points'> {
  source: WaveformPointSource
}

function normalizedSeriesOptions(
  id: string,
  series: {
    shotNo?: string
    trackId?: string
    name: string
    unit?: string
    color?: string
    lineType?: NormalizedWaveformSeries['lineType']
    lineStyle?: WaveformLineStyle
    pointType?: NormalizedWaveformSeries['pointType']
    errorBar?: { visible?: boolean; color?: string; width?: number; capWidth?: number }
  },
) {
  const requestedLineType = series.lineType ?? 'linear'
  const lineStyle = normalizeLineStyle(series.lineStyle)
  const requestedPointType = series.pointType ?? 'none'
  const errorBarVisible = series.errorBar?.visible === true
  const lineType =
    requestedLineType === 'none' && requestedPointType === 'none' && !errorBarVisible
      ? 'linear'
      : requestedLineType
  const width = Number(series.errorBar?.width)
  const capWidth = Number(series.errorBar?.capWidth)
  return {
    id,
    shotNo: series.shotNo?.trim() || undefined,
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
      capWidth: Number.isFinite(capWidth) && capWidth > 0 ? capWidth : DEFAULT_ERROR_BAR_CAP_WIDTH,
    },
  }
}

/** Internal normalized series which preserves compact TypedArray storage for chart rendering. */
export function normalizeWaveformSeriesSources(
  data: WaveformData,
): NormalizedWaveformSourceSeries[] {
  if (data.kind !== 'series') {
    const source = createWaveformPointSource(data, normalizeWaveformData)
    return source.length
      ? [
          {
            ...normalizedSeriesOptions('series-0', { name: '' }),
            source,
          },
        ]
      : []
  }

  const usedIds = new Set<string>()
  return data.series.flatMap((series, index) => {
    const id = series.id?.trim() || `series-${index}`
    let uniqueId = id
    let suffix = 1
    while (usedIds.has(uniqueId)) {
      uniqueId = `${id}-${suffix}`
      suffix += 1
    }
    usedIds.add(uniqueId)
    const source = createWaveformPointSource(series.data, normalizeWaveformData)
    return source.length ? [{ ...normalizedSeriesOptions(uniqueId, series), source }] : []
  })
}

/**
 * 规范化波形系列数据
 * @param data 输入数据（单波形或多通道）
 * @returns 规范化后的系列数组
 */
export function normalizeWaveformSeries(data: WaveformData): NormalizedWaveformSeries[] {
  return normalizeWaveformSeriesSources(data).map(({ source, ...series }) => ({
    ...series,
    points: source.pointsInRange(),
  }))
}

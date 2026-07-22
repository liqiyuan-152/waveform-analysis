import { shallowRef, watch } from 'vue'

import { normalizeWaveformSeries, resolveWaveformPointErrors } from '../../core'
import type {
  ResolvedWaveformErrorBarOptions,
  WaveformData,
  WaveformLineType,
  WaveformLineStyle,
  WaveformPoint,
  WaveformPointType,
} from '../../types'
import { paddedDomain } from '../../utils'

export interface PreparedWaveformSeries {
  id: string
  trackId?: string
  name: string
  unit?: string
  color?: string
  lineType: WaveformLineType
  lineStyle: WaveformLineStyle
  pointType: WaveformPointType
  errorBar: ResolvedWaveformErrorBarOptions
  points: WaveformPoint[]
  xDomain: [number, number]
  yDomain: [number, number]
  hasErrorPoints: boolean
}

function pointMetrics(
  points: WaveformPoint[],
  includeErrors = false,
): { xDomain: [number, number]; yDomain: [number, number]; hasErrorPoints: boolean } {
  let xMinimum = Number.POSITIVE_INFINITY
  let xMaximum = Number.NEGATIVE_INFINITY
  let yMinimum = Number.POSITIVE_INFINITY
  let yMaximum = Number.NEGATIVE_INFINITY
  let hasErrorPoints = false
  for (const point of points) {
    if (point.x < xMinimum) xMinimum = point.x
    if (point.x > xMaximum) xMaximum = point.x
    if (point.y < yMinimum) yMinimum = point.y
    if (point.y > yMaximum) yMaximum = point.y
    if (includeErrors) {
      const errors = resolveWaveformPointErrors(point)
      if (errors.lower !== 0 || errors.upper !== 0) hasErrorPoints = true
      yMinimum = Math.min(yMinimum, point.y - errors.lower)
      yMaximum = Math.max(yMaximum, point.y + errors.upper)
    }
  }
  return {
    xDomain: paddedDomain(Number.isFinite(xMinimum) ? [xMinimum, xMaximum] : []),
    yDomain: paddedDomain(Number.isFinite(yMinimum) ? [yMinimum, yMaximum] : []),
    hasErrorPoints,
  }
}

export function prepareWaveformSeries(data: WaveformData): PreparedWaveformSeries[] {
  return normalizeWaveformSeries(data).map((series) => {
    const metrics = pointMetrics(series.points, series.errorBar.visible)
    return { ...series, ...metrics }
  })
}

export function usePreparedWaveformSeries(data: () => WaveformData, onDataChange: () => void) {
  const preparedSeries = shallowRef<PreparedWaveformSeries[]>(prepareWaveformSeries(data()))
  watch(data, (nextData) => {
    preparedSeries.value = prepareWaveformSeries(nextData)
    onDataChange()
  })
  return preparedSeries
}

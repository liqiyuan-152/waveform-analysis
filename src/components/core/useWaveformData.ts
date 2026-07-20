import { shallowRef, watch } from 'vue'

import { normalizeWaveformSeries, resolveWaveformPointErrors } from '../../core'
import type {
  ResolvedWaveformErrorBarOptions,
  WaveformData,
  WaveformLineType,
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
  pointType: WaveformPointType
  errorBar: ResolvedWaveformErrorBarOptions
  points: WaveformPoint[]
  xDomain: [number, number]
  yDomain: [number, number]
}

function pointDomain(
  points: WaveformPoint[],
  key: 'x' | 'y',
  includeErrors = false,
): [number, number] {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  points.forEach((point) => {
    const value = point[key]
    if (value < minimum) minimum = value
    if (value > maximum) maximum = value
    if (key === 'y' && includeErrors) {
      const errors = resolveWaveformPointErrors(point)
      minimum = Math.min(minimum, point.y - errors.lower)
      maximum = Math.max(maximum, point.y + errors.upper)
    }
  })
  return paddedDomain(Number.isFinite(minimum) ? [minimum, maximum] : [])
}

export function prepareWaveformSeries(data: WaveformData): PreparedWaveformSeries[] {
  return normalizeWaveformSeries(data).map((series) => ({
    ...series,
    xDomain: pointDomain(series.points, 'x'),
    yDomain: pointDomain(series.points, 'y', series.errorBar.visible),
  }))
}

export function usePreparedWaveformSeries(data: () => WaveformData, onDataChange: () => void) {
  const preparedSeries = shallowRef<PreparedWaveformSeries[]>(prepareWaveformSeries(data()))
  watch(data, (nextData) => {
    preparedSeries.value = prepareWaveformSeries(nextData)
    onDataChange()
  })
  return preparedSeries
}

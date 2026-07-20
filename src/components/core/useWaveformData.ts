import { shallowRef, watch } from 'vue'

import { normalizeWaveformSeries } from '../../core'
import type { WaveformData, WaveformPoint } from '../../types'
import { paddedDomain } from '../../utils'

export interface PreparedWaveformSeries {
  id: string
  name: string
  unit?: string
  color?: string
  points: WaveformPoint[]
  xDomain: [number, number]
  yDomain: [number, number]
}

function pointDomain(points: WaveformPoint[], key: 'x' | 'y'): [number, number] {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  points.forEach((point) => {
    const value = point[key]
    if (value < minimum) minimum = value
    if (value > maximum) maximum = value
  })
  return paddedDomain(Number.isFinite(minimum) ? [minimum, maximum] : [])
}

export function prepareWaveformSeries(data: WaveformData): PreparedWaveformSeries[] {
  return normalizeWaveformSeries(data).map((series) => ({
    ...series,
    xDomain: pointDomain(series.points, 'x'),
    yDomain: pointDomain(series.points, 'y'),
  }))
}

export function usePreparedWaveformSeries(
  data: () => WaveformData,
  onDataChange: () => void,
) {
  const preparedSeries = shallowRef<PreparedWaveformSeries[]>(prepareWaveformSeries(data()))
  watch(data, (nextData) => {
    preparedSeries.value = prepareWaveformSeries(nextData)
    onDataChange()
  })
  return preparedSeries
}

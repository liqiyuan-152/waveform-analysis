import { shallowRef, watch } from 'vue'

import { normalizeWaveformSeriesSources } from '../../core/data'
import { lazyPointArray, type WaveformPointSource } from '../../core/waveformPointSource'
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
  source: WaveformPointSource
  xDomain: [number, number]
  rawYMaximum?: number
  rawYMinimum?: number
  yDomain: [number, number]
  hasErrorPoints: boolean
}

export function prepareWaveformSeries(
  data: WaveformData,
  retainEmpty = false,
): PreparedWaveformSeries[] {
  return normalizeWaveformSeriesSources(data, retainEmpty).map(({ source, ...series }) => {
    const sourceMetrics = source.metrics(series.errorBar.visible)
    return {
      ...series,
      source,
      // Existing chart code remains array-oriented; compact sources materialize individual points
      // only when an index is read.
      points: lazyPointArray(source),
      xDomain: paddedDomain(
        Number.isFinite(sourceMetrics.xMinimum)
          ? [sourceMetrics.xMinimum, sourceMetrics.xMaximum]
          : [],
      ),
      yDomain: paddedDomain(
        Number.isFinite(sourceMetrics.yMinimum)
          ? [sourceMetrics.yMinimum, sourceMetrics.yMaximum]
          : [],
      ),
      rawYMaximum: Number.isFinite(sourceMetrics.yMaximum) ? sourceMetrics.yMaximum : undefined,
      rawYMinimum: Number.isFinite(sourceMetrics.yMinimum) ? sourceMetrics.yMinimum : undefined,
      hasErrorPoints: sourceMetrics.hasErrorPoints,
    }
  })
}

export function usePreparedWaveformSeries(
  data: () => WaveformData,
  onBeforeDataChange: () => void,
  onDataChange: () => void,
  retainEmpty: () => boolean = () => false,
) {
  const preparedSeries = shallowRef<PreparedWaveformSeries[]>(
    prepareWaveformSeries(data(), retainEmpty()),
  )
  watch([data, retainEmpty], ([nextData, preserveEmpty]) => {
    onBeforeDataChange()
    preparedSeries.value = prepareWaveformSeries(nextData, preserveEmpty)
    onDataChange()
  })
  return preparedSeries
}

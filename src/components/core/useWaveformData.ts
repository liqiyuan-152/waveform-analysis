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
    const previousById = new Map(preparedSeries.value.map((series) => [series.id, series]))
    preparedSeries.value = prepareWaveformSeries(nextData, preserveEmpty).map((series) => {
      const previous = previousById.get(series.id)
      // Preserve axes, never geometry, across empty windows of the same channel/track.
      if (series.source.length || !previous || series.trackId !== previous.trackId) return series
      return {
        ...series,
        xDomain: previous.xDomain,
        yDomain: previous.yDomain,
        rawYMaximum: previous.rawYMaximum,
        rawYMinimum: previous.rawYMinimum,
      }
    })
    onDataChange()
  })
  return preparedSeries
}

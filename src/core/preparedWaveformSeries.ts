import { normalizeWaveformSeriesSources } from './data'
import { lazyPointArray, type WaveformPointSource } from './waveformPointSource'
import type {
  ResolvedWaveformErrorBarOptions,
  WaveformData,
  WaveformLineType,
  WaveformLineStyle,
  WaveformPoint,
  WaveformPointType,
} from '../types'
import { paddedDomain } from '../utils'

export interface PreparedWaveformSeries {
  id: string
  trackId?: string
  name: string
  unit?: string
  color?: string
  lineType: WaveformLineType
  lineStyle: WaveformLineStyle
  pointType: WaveformPointType
  pointSize?: number
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
  sourceFor?: Parameters<typeof normalizeWaveformSeriesSources>[2],
  previousById?: ReadonlyMap<string, PreparedWaveformSeries>,
): PreparedWaveformSeries[] {
  return normalizeWaveformSeriesSources(data, retainEmpty, sourceFor).map(
    ({ source, ...series }) => {
      const previous = previousById?.get(series.id)
      if (
        previous?.source === source &&
        previous.errorBar.visible === series.errorBar.visible &&
        (source.length || previous.trackId === series.trackId)
      ) {
        const same = Object.entries(series).every(([key, value]) =>
          key === 'errorBar'
            ? Object.entries(series.errorBar).every(
                ([field, entry]) =>
                  entry === previous.errorBar[field as keyof typeof series.errorBar],
              )
            : value === previous[key as keyof PreparedWaveformSeries],
        )
        return same ? previous : { ...previous, ...series }
      }
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
    },
  )
}

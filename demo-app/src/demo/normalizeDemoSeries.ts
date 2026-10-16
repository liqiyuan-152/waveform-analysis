import {
  normalizeWaveformData,
  normalizeWaveformSeries,
  type WaveformData,
} from 'waveform-analysis'

/** Mock remote responses retain empty channels; public normalization omits empty series. */
export function normalizeDemoSeries(data: WaveformData) {
  if (data.kind !== 'series') return normalizeWaveformSeries(data)
  const points = data.series.map((series) => normalizeWaveformData(series.data))
  const normalized = normalizeWaveformSeries({
    kind: 'series',
    series: data.series.map((series, index) => ({
      ...series,
      // A temporary point lets the public normalizer allocate IDs/defaults for empty channels.
      // It is removed before any response is returned and never reaches chart data.
      data: { kind: 'points', points: points[index]!.length ? points[index]! : [{ x: 0, y: 0 }] },
    })),
  })
  return normalized.map((series, index) => ({ ...series, points: points[index]! }))
}

import type { WaveformModel } from '../../model/WaveformModel.js'

export function resolveSeriesAction(model: WaveformModel, seriesId: string): string {
  const matches = model.keyedSeries.filter((item) => item.series.id?.trim() === seriesId.trim())
  if (!seriesId.trim() || matches.length !== 1)
    throw new Error('toggleSeries requires one unique seriesId')
  return matches[0].key
}

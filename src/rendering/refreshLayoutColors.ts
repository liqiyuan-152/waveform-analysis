import { channelColors } from '../components/core/constants'
import type { DisplaySeries, TrackLayout } from '../components/core/types'
import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import type { PreparedWaveformSeries } from '../core/preparedWaveformSeries'

/** Only internal display records are mutable; consumer data and point sources are untouched. */
export function refreshLayoutColors(
  layout: ChartLayoutSnapshot,
  prepared: readonly PreparedWaveformSeries[],
  lineColor: string,
) {
  const colors = new Map(
    prepared.map((series, index) => [
      series.id,
      series.color ?? (index === 0 ? lineColor : channelColors[index % channelColors.length]!),
    ]),
  )
  const refresh = (series: DisplaySeries) => {
    const color = colors.get(series.id)
    if (color !== undefined) series.color = color
  }
  const track = (track: TrackLayout) => {
    track.seriesList.forEach(refresh)
    track.legendSeries.forEach(refresh)
    track.seriesPaths.forEach((path) => refresh(path.series))
    track.yAxes.forEach((axis) => axis.seriesList.forEach(refresh))
  }
  layout.tracks.forEach((track) => track.series.forEach(refresh))
  layout.trackLayouts.forEach(track)
  return layout
}

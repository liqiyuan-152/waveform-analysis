import { chartExportOptions } from '../../components/controls/chartExportOptions'
import type { ResolvedWaveformChartProps } from '../../types/options'
import type { TrackLayout } from '../../components/core/types'
import type { TrackPresentation } from './trackPresentation'

/** Only domains may change: resizing, visibility and axis membership require a new layout. */
export function compatibleViewportTracks(
  tracks: TrackLayout[],
  states: ReadonlyMap<string, TrackPresentation>,
) {
  return (
    tracks.length === states.size &&
    tracks.every((track) => {
      const previous = states.get(track.id)?.target
      return (
        previous &&
        track.width === previous.width &&
        track.height === previous.height &&
        track.left === previous.left &&
        track.top === previous.top &&
        track.seriesList.length === previous.seriesList.length &&
        track.seriesList.every((series, index) => series.id === previous.seriesList[index].id) &&
        track.yAxes.length === previous.yAxes.length &&
        track.yAxes.every((axis, index) => {
          const old = previous.yAxes[index]
          return (
            axis.seriesList.length === old.seriesList.length &&
            axis.seriesList.every((series, i) => series.id === old.seriesList[i].id)
          )
        })
      )
    })
  )
}

export function presentationOptionsSignature(props: ResolvedWaveformChartProps) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(chartExportOptions(props)).filter(
        ([key]) => !['annotations', 'annotationsVisible', 'lineColor'].includes(key),
      ),
    ),
  )
}

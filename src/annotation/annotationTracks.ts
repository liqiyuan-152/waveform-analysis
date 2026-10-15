import type { TrackLayout } from '../components/core/types'
import type { AnnotationTrackLayout } from './types'

/** Use full series sources and the corresponding series axis, never sampled paths. */
export function annotationTracks(tracks: TrackLayout[]): AnnotationTrackLayout[] {
  return tracks.flatMap((track) =>
    track.seriesList.map((series) => ({
      ...track,
      series,
      yScale:
        track.seriesPaths.find((path) => path.series.id === series.id)?.yScale ?? track.yScale,
    })),
  )
}

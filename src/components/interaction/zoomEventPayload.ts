import type { TrackLayout } from '../core/types'
import type { WaveformChartEmit } from '../core/waveformChartTypes'

export function seriesIdentity(seriesIds: readonly string[]) {
  return [...seriesIds].sort().join('\u0000')
}

export function findTrackBySeriesIds(
  trackLayouts: readonly TrackLayout[],
  seriesIds: readonly string[],
) {
  const identity = seriesIdentity(seriesIds)
  return trackLayouts.find(
    (track) => seriesIdentity(track.seriesList.map((series) => series.id)) === identity,
  )
}

export function emitBoxZoomIntent(
  emit: WaveformChartEmit,
  domain: [number, number],
  track: TrackLayout,
  independent: boolean,
) {
  emit(
    'zoom-intent',
    independent
      ? {
          start: domain[0],
          end: domain[1],
          trackIndex: track.index,
          seriesIds: track.seriesList.map((series) => series.id),
          gesture: 'box',
        }
      : { start: domain[0], end: domain[1], gesture: 'box' },
  )
}

export function emitIndependentWheelZoomEnds(
  emit: WaveformChartEmit,
  trackLayouts: readonly TrackLayout[],
  pendingSeriesIds: Iterable<readonly string[]>,
) {
  for (const seriesIds of pendingSeriesIds) {
    const track = findTrackBySeriesIds(trackLayouts, seriesIds)
    if (!track) continue
    const domain = track.xScale.domain() as [number, number]
    const yDomain = track.yScale.domain()
    emit('zoom-end', {
      start: domain[0],
      end: domain[1],
      yStart: yDomain[0],
      yEnd: yDomain[1],
      trackIndex: track.index,
      seriesIds: [...seriesIds],
      gesture: 'wheel',
    })
  }
}

export function emitSharedWheelZoomEnd(
  emit: WaveformChartEmit,
  domain: [number, number],
  trackLayouts: readonly TrackLayout[],
) {
  const visibleTracks = trackLayouts.filter((track) => track.hasVisibleSeries)
  if (visibleTracks.length === 1) {
    const yDomain = visibleTracks[0]?.yScale.domain()
    emit('zoom-end', {
      start: domain[0],
      end: domain[1],
      yStart: yDomain?.[0],
      yEnd: yDomain?.[1],
      gesture: 'wheel',
    })
    return
  }
  emit('zoom-end', {
    start: domain[0],
    end: domain[1],
    yRanges: Object.fromEntries(
      visibleTracks.map((track) => [
        track.series?.trackId ?? track.series?.id ?? track.id,
        track.yScale.domain() as [number, number],
      ]),
    ),
    gesture: 'wheel',
  })
}

import type { DisplayTrack } from './types'

export const resolvePageableTracks = (
  tracks: DisplayTrack[],
  hideEmptyTracks?: boolean,
): DisplayTrack[] => (hideEmptyTracks ? tracks.filter((track) => track.series.length > 0) : tracks)

export const resolveTrackFrameNumber = (
  frameNumber: string | number | undefined,
  frameNumbers: Record<string, string | number> | undefined,
  trackCount: number,
  trackIndex: number,
  trackId: string,
): string | number | undefined => {
  const mappedFrameNumber = frameNumbers?.[trackId]
  if (mappedFrameNumber !== undefined) return mappedFrameNumber
  if (frameNumber === undefined) return undefined
  if (trackCount === 1) return frameNumber
  return typeof frameNumber === 'number'
    ? frameNumber + trackIndex
    : `${frameNumber}-${trackIndex + 1}`
}

export const createFrameNumberResolver =
  (
    getFrameNumber: () => string | number | undefined,
    getFrameNumbers: () => Record<string, string | number> | undefined,
    getTracks: () => DisplayTrack[],
  ) =>
  (trackId: string): string | number | undefined => {
    const tracks = getTracks()
    const trackIndex = tracks.findIndex((track) => track.id === trackId)
    return resolveTrackFrameNumber(
      getFrameNumber(),
      getFrameNumbers(),
      tracks.length,
      trackIndex >= 0 ? trackIndex : 0,
      trackId,
    )
  }

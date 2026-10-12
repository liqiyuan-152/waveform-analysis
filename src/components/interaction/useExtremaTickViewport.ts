import { watch, type ComputedRef, type ShallowRef } from 'vue'
import type { ZoomTransform } from 'd3'

import type { TrackLayout } from '../core/types'

/** Keep X coordinates stable when toggling extrema changes the reserved Y-label width. */
export function useExtremaTickViewport(
  visible: () => number,
  innerWidth: ComputedRef<number>,
  tracks: ComputedRef<TrackLayout[]>,
  sharedTransform: ShallowRef<ZoomTransform>,
  independentTransforms: ShallowRef<ZoomTransform[]>,
) {
  const resizeTransform = (transform: ZoomTransform, previous: number, next: number) =>
    previous > 0 && next > 0
      ? transform.translate(((next / previous - 1) * transform.x) / transform.k, 0)
      : transform

  watch(
    () => ({
      visible: visible(),
      width: innerWidth.value,
      tracks: tracks.value.map((track) => ({
        id: track.id,
        index: track.index,
        width: track.width,
      })),
    }),
    (next, previous) => {
      if (next.visible === previous.visible) return
      sharedTransform.value = resizeTransform(sharedTransform.value, previous.width, next.width)
      const transforms = [...independentTransforms.value]
      next.tracks.forEach((track) => {
        const prior = previous.tracks.find((item) => item.id === track.id)
        const transform = transforms[track.index]
        if (prior && transform) {
          transforms[track.index] = resizeTransform(transform, prior.width, track.width)
        }
      })
      independentTransforms.value = transforms
    },
  )
}

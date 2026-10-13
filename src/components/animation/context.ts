import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { TrackLayout } from '../core/types'
import type { PreparedWaveformSeries } from '../core/useWaveformData'
import type { ResolvedWaveformChartProps } from '../core/waveformChartTypes'

export interface AnimationContext {
  props: ResolvedWaveformChartProps
  tracks: ComputedRef<TrackLayout[]>
  currentPage: Ref<number>
  containerSize: ComputedRef<number[]>
  preparedSeries: ShallowRef<PreparedWaveformSeries[]>
  layoutReady: ComputedRef<boolean>
  innerWidth: ComputedRef<number>
  innerHeight: ComputedRef<number>
  sampling: {
    state: ComputedRef<'pending' | 'success' | 'fallback' | 'error'>
    requestSignature: ComputedRef<string>
  }
}

export function animationLayoutSignature(context: AnimationContext) {
  const { props, tracks } = context
  return JSON.stringify({
    tracks: tracks.value.map((track) => [
      track.id,
      track.left,
      track.top,
      track.width,
      track.height,
      track.seriesList.map((series) => series.id),
      track.yAxes.map((axis) => axis.seriesList.map((series) => series.id)),
    ]),
    width: context.innerWidth.value,
    height: context.innerHeight.value,
    mode: props.displayMode,
    overlay: props.overlayMode,
    hidden: props.hiddenSeriesIds,
    clean: props.cleanView,
    presentation: props.presentationMode,
    page: tracks.value.map((track) => track.id),
  })
}

export function wrapAnimationCommands<T extends object>(commands: T, stabilize: () => void): T {
  return Object.fromEntries(
    Object.entries(commands).map(([key, value]) => [
      key,
      typeof value === 'function' && key !== 'getControlState'
        ? (...args: unknown[]) => {
            stabilize()
            return value(...args)
          }
        : value,
    ]),
  ) as T
}

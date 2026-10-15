import type { TrackLayout } from '../../components/core/types'
import { normalizeGridOptions } from '../../components/core/grid'
import type { PreparedWaveformSeries } from '../../core/preparedWaveformSeries'
import type { ResolvedWaveformChartProps } from '../../types/options'

export interface AnimationValueReader<T> {
  readonly value: T
}

export interface AnimationContext {
  props: ResolvedWaveformChartProps
  tracks: AnimationValueReader<TrackLayout[]>
  currentPage: AnimationValueReader<number>
  containerSize: AnimationValueReader<number[]>
  preparedSeries: AnimationValueReader<readonly PreparedWaveformSeries[]>
  layoutReady: AnimationValueReader<boolean>
  innerWidth: AnimationValueReader<number>
  innerHeight: AnimationValueReader<number>
  sampling: {
    state: AnimationValueReader<'pending' | 'success' | 'fallback' | 'error'>
    requestSignature: AnimationValueReader<string>
  }
}

export function animationGridShape(context: AnimationContext) {
  const grid = normalizeGridOptions(context.props.grid)
  return `${grid.rowCount}:${grid.columnCount}`
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
      track.xScale.domain(),
      track.yScale.domain(),
      track.seriesList.map((series) => series.id),
      track.yAxes.map((axis) => [axis.seriesList.map((series) => series.id), axis.scale.domain()]),
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

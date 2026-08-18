import { nextTick, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import type { ZoomTransform } from 'd3'

import type { TrackLayout } from '../core/types'
import type { ResolvedWaveformChartProps } from '../core/waveformChartTypes'
import type { AnnotationSeriesCandidate } from '../annotation'
import { constrainZoomDomain, transformForDomain } from './zoomConstraints'

interface ViewportDomainContext {
  props: ResolvedWaveformChartProps
  trackLayouts: ComputedRef<TrackLayout[]>
  initialXDomain: ComputedRef<[number, number]>
  resolveInitialTrackDomain: (track: TrackLayout) => [number, number]
  innerWidth: ComputedRef<number>
  sharedTransform: ShallowRef<ZoomTransform>
  independentTransforms: ShallowRef<ZoomTransform[]>
  cancelPendingZoom: () => void
  cancelViewportDrag: () => void
  clearHover: () => void
  editorSeriesOptions: Ref<AnnotationSeriesCandidate[]>
  configureZoom: () => void
}

export function createViewportDomainSetter(context: ViewportDomainContext) {
  return (domain: [number, number], trackIndex?: number) => {
    if (!Number.isFinite(domain[0]) || !Number.isFinite(domain[1]) || domain[0] === domain[1])
      return
    context.cancelPendingZoom()
    context.cancelViewportDrag()
    if (context.props.displayMode === 'independent') {
      const indexes =
        trackIndex === undefined
          ? context.trackLayouts.value.map((track) => track.index)
          : [trackIndex]
      const nextTransforms = [...context.independentTransforms.value]
      indexes.forEach((index) => {
        const track = context.trackLayouts.value.find((item) => item.index === index)
        if (!track) return
        const boundary = context.resolveInitialTrackDomain(track)
        const constrained = constrainZoomDomain(domain, boundary, [track.seriesList], context.props)
        nextTransforms[index] = transformForDomain(constrained, boundary, track.width)
      })
      context.independentTransforms.value = nextTransforms
    } else {
      const boundary = context.initialXDomain.value
      const groups = context.trackLayouts.value
        .filter((track) => track.hasVisibleSeries)
        .map((track) => track.seriesList)
      const constrained = constrainZoomDomain(domain, boundary, groups, context.props)
      context.sharedTransform.value = transformForDomain(
        constrained,
        boundary,
        context.innerWidth.value,
      )
    }
    context.clearHover()
    context.editorSeriesOptions.value = []
    void nextTick(context.configureZoom)
  }
}

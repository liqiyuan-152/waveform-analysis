import { nextTick } from 'vue'
import { zoomIdentity } from 'd3'
import { constrainZoomDomain, transformForDomain } from '../interaction/zoomConstraints'
import { seriesIdentity } from '../interaction/zoomEventPayload'
import type { LifecycleContext } from './useWaveformChartLifecycle'

export function useWaveformViewportRestore(
  context: Pick<
    LifecycleContext,
    | 'preserveFullViewport'
    | 'props'
    | 'trackLayouts'
    | 'resolveInitialTrackDomain'
    | 'sharedZoomDomain'
    | 'initialXDomain'
    | 'independentTransforms'
    | 'chartTracks'
    | 'clearHover'
    | 'editorSeriesOptions'
    | 'sharedTransform'
    | 'innerWidth'
    | 'configureZoom'
  >,
) {
  const {
    props,
    trackLayouts,
    resolveInitialTrackDomain,
    sharedZoomDomain,
    initialXDomain,
    independentTransforms,
    chartTracks,
    clearHover,
    editorSeriesOptions,
    sharedTransform,
    innerWidth,
    configureZoom,
  } = context
  let pendingSharedXDomain: [number, number] | undefined
  let pendingIndependentXDomains: Map<string, [number, number]> | undefined

  function handleBeforeDataReferenceChange() {
    if (props.displayMode === 'independent') {
      pendingSharedXDomain = undefined
      pendingIndependentXDomains = new Map(
        trackLayouts.value.flatMap((track) => {
          const current = track.xScale.domain() as [number, number]
          const boundary = resolveInitialTrackDomain(track)
          return context.preserveFullViewport?.() ||
            current[1] - current[0] < boundary[1] - boundary[0] - 1e-12
            ? [[seriesIdentity(track.seriesList.map((series) => series.id)), current]]
            : []
        }),
      )
      return
    }
    pendingIndependentXDomains = undefined
    const current = sharedZoomDomain.value
    const boundary = initialXDomain.value
    pendingSharedXDomain =
      context.preserveFullViewport?.() ||
      current[1] - current[0] < boundary[1] - boundary[0] - 1e-12
        ? [...current]
        : undefined
  }

  function handleDataReferenceChange() {
    if (props.displayMode === 'independent') {
      const currentTransforms = independentTransforms.value
      independentTransforms.value = chartTracks.value.map(
        (_track, index) => currentTransforms[index] ?? zoomIdentity,
      )
    }
    clearHover()
    editorSeriesOptions.value = []
    void nextTick(() => {
      if (props.displayMode === 'independent' && pendingIndependentXDomains) {
        const nextTransforms = chartTracks.value.map(() => zoomIdentity)
        trackLayouts.value.forEach((track) => {
          const previousDomain = pendingIndependentXDomains?.get(
            seriesIdentity(track.seriesList.map((series) => series.id)),
          )
          if (!previousDomain) return
          const boundary = resolveInitialTrackDomain(track)
          const domain = constrainZoomDomain(previousDomain, boundary, [track.seriesList], props)
          nextTransforms[track.index] = transformForDomain(domain, boundary, track.width)
        })
        independentTransforms.value = nextTransforms
        pendingIndependentXDomains = undefined
      } else if (props.displayMode !== 'independent' && pendingSharedXDomain) {
        const boundary = initialXDomain.value
        const groups = trackLayouts.value
          .filter((track) => track.hasVisibleSeries)
          .map((track) => track.seriesList)
        const domain = constrainZoomDomain(pendingSharedXDomain, boundary, groups, props)
        sharedTransform.value = transformForDomain(domain, boundary, innerWidth.value)
        pendingSharedXDomain = undefined
      }
      configureZoom()
    })
  }

  return { handleBeforeDataReferenceChange, handleDataReferenceChange }
}

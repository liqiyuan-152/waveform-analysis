import type { TrackLayout } from '../core/types'
import { hasFixedYDomainForTrack } from '../core/yDomain'
import type { ViewportSelectionState } from '../core/waveformChartTypes'
import type { ViewportContext } from './useWaveformViewport'
import { clampViewportDomain as clampDomain } from './viewportDomain'
import { alignIntegerPanDomain } from './integerZoom'
import { remotePanBoundary } from './remoteViewport'
import { transformForDomain } from './zoomConstraints'

export function createViewportPan(context: ViewportContext) {
  const {
    props,
    emit,
    resolveInitialTrackDomain,
    initialXDomain,
    independentTransforms,
    sharedTransform,
    innerWidth,
    trackLayouts,
    chartTracks,
    independentYDomains,
    sharedYDomains,
  } = context
  const applyPan = (active: ViewportSelectionState, track: TrackLayout) => {
    const width = track.width || 1
    const height = track.height || 1
    const dx = active.currentX - active.startX
    const dy = active.currentY - active.startY
    const xSpan = active.xDomain[1] - active.xDomain[0]
    const sourceXDomain = active.independent
      ? resolveInitialTrackDomain(track)
      : initialXDomain.value
    const boundary = remotePanBoundary(props) ?? sourceXDomain
    const nextX = clampDomain(
      alignIntegerPanDomain(
        clampDomain(
          [active.xDomain[0] - (dx / width) * xSpan, active.xDomain[1] - (dx / width) * xSpan],
          boundary,
        ),
        props,
      ),
      boundary,
    )
    if (active.independent) {
      const nextTransforms = [...independentTransforms.value]
      nextTransforms[track.index] = transformForDomain(nextX, sourceXDomain, width)
      independentTransforms.value = nextTransforms
    } else {
      sharedTransform.value = transformForDomain(nextX, sourceXDomain, innerWidth.value)
    }
    if (remotePanBoundary(props)) {
      emit('zoom-change', nextX)
      return nextX
    }
    const targets = active.independent
      ? [track]
      : trackLayouts.value.filter((target) => target.hasVisibleSeries)
    const nextIndependentDomains = { ...independentYDomains.value }
    const nextSharedDomains = { ...sharedYDomains.value }
    targets.forEach((target) => {
      const chartTrack = chartTracks.value.find((item) => item.id === target.id)
      if (chartTrack && hasFixedYDomainForTrack(chartTrack, props.yDomain, props.yDomains)) {
        return
      }
      const key = target.series?.trackId ?? target.series?.id ?? target.id
      const source = active.yDomains[key] ?? (target.yScale.domain() as [number, number])
      const boundary = chartTrack?.yDomain ?? source
      const ySpan = source[1] - source[0]
      const nextY = clampDomain(
        [source[0] + (dy / height) * ySpan, source[1] + (dy / height) * ySpan],
        boundary,
      )
      if (active.independent) nextIndependentDomains[target.index] = nextY
      else nextSharedDomains[key] = nextY
    })
    if (active.independent) independentYDomains.value = nextIndependentDomains
    else sharedYDomains.value = nextSharedDomains
    emit('zoom-change', nextX)
    return nextX
  }
  return applyPan
}

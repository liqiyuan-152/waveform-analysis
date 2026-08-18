import { pointer, zoomIdentity, type ZoomTransform } from 'd3'
import { computed, nextTick, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import { MINIMUM_SELECTION_SIZE } from '../core/constants'
import type { DisplayTrack, TrackLayout } from '../core/types'
import { hasFixedYDomainForTrack } from '../core/yDomain'
import type {
  ResolvedWaveformChartProps,
  ViewportSelectionState,
  WaveformChartEmit,
} from '../core/waveformChartTypes'
import type { AnnotationSeriesCandidate } from '../annotation'
import { tryReleasePointerCapture } from './pointerCapture'
import { transitionViewportInteraction } from './viewportInteractionState'
import { createViewportDomainSetter } from './viewportDomain'
import { constrainZoomDomain, transformForDomain } from './zoomConstraints'
interface ViewportContext {
  props: ResolvedWaveformChartProps
  emit: WaveformChartEmit
  selection: Ref<ViewportSelectionState | null>
  spacePressed: Ref<boolean>
  trackLayouts: ComputedRef<TrackLayout[]>
  chartTracks: ComputedRef<DisplayTrack[]>
  initialXDomain: ComputedRef<[number, number]>
  innerWidth: ComputedRef<number>
  innerHeight: ComputedRef<number>
  sharedOverlayElement: ShallowRef<SVGRectElement | undefined>
  sharedTransform: ShallowRef<ZoomTransform>
  independentTransforms: ShallowRef<ZoomTransform[]>
  sharedYDomains: Ref<Record<string, [number, number]>>
  independentYDomains: Ref<Record<number, [number, number]>>
  isZoomMode: ComputedRef<boolean>
  isPresentationMode: ComputedRef<boolean>
  editorSeriesOptions: Ref<AnnotationSeriesCandidate[]>
  resolveInitialTrackDomain: (track: TrackLayout) => [number, number]
  canZoomTrack: (track: TrackLayout) => boolean
  canZoomSharedTracks: () => boolean
  configureZoom: () => void
  cancelPendingZoom: () => void
  clearHover: () => void
  resolveTrackAtPointer: (pointerX: number, pointerY: number) => TrackLayout | undefined
}
export function useWaveformViewport(context: ViewportContext) {
  const {
    props,
    emit,
    selection,
    spacePressed,
    trackLayouts,
    chartTracks,
    initialXDomain,
    innerWidth,
    innerHeight,
    sharedOverlayElement,
    sharedTransform,
    independentTransforms,
    sharedYDomains,
    independentYDomains,
    isZoomMode,
    isPresentationMode,
    editorSeriesOptions,
    resolveInitialTrackDomain,
    canZoomTrack,
    canZoomSharedTracks,
    configureZoom,
    cancelPendingZoom,
    clearHover,
    resolveTrackAtPointer,
  } = context
  const activeOverlay = shallowRef<SVGRectElement>()
  const releasePointerCapture = (pointerId: number, event?: PointerEvent) => {
    const overlay = activeOverlay.value
    const eventTarget = event?.currentTarget as SVGRectElement | null
    tryReleasePointerCapture(overlay, pointerId)
    if (eventTarget && eventTarget !== overlay) tryReleasePointerCapture(eventTarget, pointerId)
  }
  const cleanupViewportDrag = (pointerId: number, event?: PointerEvent) => {
    const active = selection.value
    if (!active || active.pointerId !== pointerId) return
    releasePointerCapture(pointerId, event)
    selection.value = transitionViewportInteraction(selection.value, {
      type: 'cancel',
      pointerId,
    }).state
    activeOverlay.value = undefined
  }
  const selectionBox = computed(() => {
    const active = selection.value
    if (!active) return null
    const track = trackLayouts.value.find((item) => item.index === active.trackIndex)
    return {
      x: Math.min(active.startX, active.currentX) + (active.independent ? (track?.left ?? 0) : 0),
      y: Math.min(active.startY, active.currentY) + (active.independent ? (track?.top ?? 0) : 0),
      width: Math.abs(active.currentX - active.startX),
      height: Math.abs(active.currentY - active.startY),
    }
  })
  const clampDomain = (domain: [number, number], boundary: [number, number]): [number, number] => {
    const span = domain[1] - domain[0]
    const boundarySpan = boundary[1] - boundary[0]
    if (span >= boundarySpan) return [...boundary]
    if (domain[0] < boundary[0]) return [boundary[0], boundary[0] + span]
    if (domain[1] > boundary[1]) return [boundary[1] - span, boundary[1]]
    return domain
  }
  const currentYDomains = (): Record<string, [number, number]> =>
    Object.fromEntries(
      trackLayouts.value.map((track) => [
        track.series.trackId ?? track.series.id,
        track.yScale.domain() as [number, number],
      ]),
    )
  const beginViewportDrag = (event: PointerEvent, trackIndex: number, independent: boolean) => {
    if (isPresentationMode.value) return
    const panRequested = props.pannable && spacePressed.value
    if ((!props.zoomable && !panRequested) || !isZoomMode.value || event.button !== 0) return
    const overlay = event.currentTarget as SVGRectElement
    const track = trackLayouts.value.find((item) => item.index === trackIndex)
    if (!track) return
    const [rawX, rawY] = pointer(event, overlay)
    const x = Math.max(0, Math.min(independent ? track.width : innerWidth.value, rawX))
    const y = Math.max(0, Math.min(independent ? track.height : innerHeight.value, rawY))
    const started = transitionViewportInteraction(selection.value, {
      type: 'begin',
      gesture: {
        trackIndex,
        independent,
        startX: x,
        startY: y,
        pointerId: event.pointerId,
        kind: panRequested ? 'pan' : 'box',
        xDomain: track.xScale.domain() as [number, number],
        yDomains: currentYDomains(),
      },
    })
    if (!started.accepted) return
    selection.value = started.state
    activeOverlay.value = overlay
    overlay.setPointerCapture?.(event.pointerId)
    clearHover()
    event.preventDefault()
  }
  const beginSharedViewportDrag = (event: PointerEvent) => {
    if (!sharedOverlayElement.value) return
    const [x, y] = pointer(event, sharedOverlayElement.value)
    const track =
      resolveTrackAtPointer(x, y) ?? trackLayouts.value.find((item) => item.hasVisibleSeries)
    if (track) beginViewportDrag(event, track.index, false)
  }
  const applyPan = (active: ViewportSelectionState, track: TrackLayout) => {
    const width = track.width || 1
    const height = track.height || 1
    const dx = active.currentX - active.startX
    const dy = active.currentY - active.startY
    const xSpan = active.xDomain[1] - active.xDomain[0]
    const sourceXDomain = active.independent
      ? resolveInitialTrackDomain(track)
      : initialXDomain.value
    const nextX = clampDomain(
      [active.xDomain[0] - (dx / width) * xSpan, active.xDomain[1] - (dx / width) * xSpan],
      sourceXDomain,
    )
    if (active.independent) {
      const nextTransforms = [...independentTransforms.value]
      nextTransforms[track.index] = transformForDomain(nextX, sourceXDomain, width)
      independentTransforms.value = nextTransforms
    } else {
      sharedTransform.value = transformForDomain(nextX, sourceXDomain, innerWidth.value)
    }
    const targets = active.independent ? [track] : trackLayouts.value
    const nextIndependentDomains = { ...independentYDomains.value }
    const nextSharedDomains = { ...sharedYDomains.value }
    targets.forEach((target) => {
      const chartTrack = chartTracks.value.find((item) => item.id === target.id)
      if (chartTrack && hasFixedYDomainForTrack(chartTrack, props.yDomain, props.yDomains)) {
        return
      }
      const key = target.series.trackId ?? target.series.id
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
  }
  const updateViewportDrag = (event: PointerEvent) => {
    if (isPresentationMode.value) return
    const active = selection.value
    const overlay = activeOverlay.value
    if (!active || !overlay || event.pointerId !== active.pointerId) return
    const track = trackLayouts.value.find((item) => item.index === active.trackIndex)
    if (!track) return
    const [rawX, rawY] = pointer(event, overlay)
    const currentX = Math.max(
      0,
      Math.min(active.independent ? track.width : innerWidth.value, rawX),
    )
    const currentY = Math.max(
      0,
      Math.min(active.independent ? track.height : innerHeight.value, rawY),
    )
    const transition = transitionViewportInteraction(selection.value, {
      type: 'move',
      pointerId: event.pointerId,
      position: { currentX, currentY },
    })
    if (!transition.accepted || !transition.state) return
    const next = transition.state
    selection.value = next
    if (next.kind === 'pan') applyPan(next, track)
    event.preventDefault()
  }
  const cancelViewportDrag = (event?: PointerEvent) => {
    const active = selection.value
    if (!active || (event && event.pointerId !== active.pointerId)) return
    cleanupViewportDrag(active.pointerId, event)
  }
  const applyBoxZoom = (active: ViewportSelectionState) => {
    const track = trackLayouts.value.find((item) => item.index === active.trackIndex)
    if (!track || (active.independent ? !canZoomTrack(track) : !canZoomSharedTracks())) return
    const offsetX = active.independent ? 0 : track.left
    const left = Math.max(
      0,
      Math.min(track.width, Math.min(active.startX, active.currentX) - offsetX),
    )
    const right = Math.max(
      0,
      Math.min(track.width, Math.max(active.startX, active.currentX) - offsetX),
    )
    if (right - left < MINIMUM_SELECTION_SIZE) return
    const baseXDomain = active.independent ? resolveInitialTrackDomain(track) : initialXDomain.value
    const groups = active.independent
      ? [track.seriesList]
      : trackLayouts.value.filter((item) => item.hasVisibleSeries).map((item) => item.seriesList)
    const xDomain = constrainZoomDomain(
      [track.xScale.invert(left), track.xScale.invert(right)],
      baseXDomain,
      groups,
      props,
    )
    if (active.independent) {
      const next = [...independentTransforms.value]
      next[track.index] = transformForDomain(xDomain, baseXDomain, track.width)
      independentTransforms.value = next
    } else {
      sharedTransform.value = transformForDomain(xDomain, baseXDomain, innerWidth.value)
    }
    const targets = active.independent ? [track] : trackLayouts.value
    const yRanges = Object.fromEntries(
      targets.map((target) => [
        target.series.trackId ?? target.series.id,
        target.yScale.domain() as [number, number],
      ]),
    )
    emit('zoom-change', xDomain)
    if (active.independent) {
      const yDomain = yRanges[track.series.trackId ?? track.series.id]
      emit('zoom-end', {
        start: xDomain[0],
        end: xDomain[1],
        trackIndex: track.index,
        seriesIds: track.seriesList.map((series) => series.id),
        yStart: yDomain?.[0],
        yEnd: yDomain?.[1],
        gesture: 'box',
      })
    } else if (targets.length === 1) {
      const yDomain = Object.values(yRanges)[0]
      emit('zoom-end', {
        start: xDomain[0],
        end: xDomain[1],
        yStart: yDomain?.[0],
        yEnd: yDomain?.[1],
        gesture: 'box',
      })
    } else {
      emit('zoom-end', { start: xDomain[0], end: xDomain[1], yRanges, gesture: 'box' })
    }
    void nextTick(configureZoom)
  }
  const finishViewportDrag = (event: PointerEvent) => {
    if (isPresentationMode.value) {
      cancelViewportDrag()
      return
    }
    const active = selection.value
    if (!active || event.pointerId !== active.pointerId) return
    const track = trackLayouts.value.find((item) => item.index === active.trackIndex)
    const overlay = activeOverlay.value
    if (!track || !overlay || !overlay.parentNode) {
      cleanupViewportDrag(active.pointerId, event)
      return
    }
    const [rawX, rawY] = pointer(event, overlay)
    const currentX = Math.max(
      0,
      Math.min(active.independent ? track.width : innerWidth.value, rawX),
    )
    const currentY = Math.max(
      0,
      Math.min(active.independent ? track.height : innerHeight.value, rawY),
    )
    const completed = transitionViewportInteraction(selection.value, {
      type: 'finish',
      pointerId: event.pointerId,
      position: { currentX, currentY },
    }).completed
    if (!completed) return
    selection.value = null
    releasePointerCapture(completed.pointerId, event)
    activeOverlay.value = undefined
    event.preventDefault()
    if (completed.kind === 'pan') {
      applyPan(completed, track)
      void nextTick(configureZoom)
      return
    }
    if (Math.abs(completed.currentX - completed.startX) >= MINIMUM_SELECTION_SIZE) {
      applyBoxZoom(completed)
    }
  }
  const resetViewport = (trackIndex?: number) => {
    cancelPendingZoom()
    cancelViewportDrag()
    if (props.displayMode === 'independent' && trackIndex !== undefined) {
      const nextTransforms = [...independentTransforms.value]
      nextTransforms[trackIndex] = zoomIdentity
      independentTransforms.value = nextTransforms
      const nextYDomains = { ...independentYDomains.value }
      delete nextYDomains[trackIndex]
      independentYDomains.value = nextYDomains
    } else {
      sharedTransform.value = zoomIdentity
      independentTransforms.value = chartTracks.value.map(() => zoomIdentity)
      sharedYDomains.value = {}
      independentYDomains.value = {}
    }
    clearHover()
    editorSeriesOptions.value = []
    void nextTick(configureZoom)
  }
  const setViewportDomain = createViewportDomainSetter({
    props,
    trackLayouts,
    initialXDomain,
    resolveInitialTrackDomain,
    innerWidth,
    sharedTransform,
    independentTransforms,
    cancelPendingZoom,
    cancelViewportDrag,
    clearHover,
    editorSeriesOptions,
    configureZoom,
  })
  const requestViewportReset = (event: MouseEvent) => {
    if (isPresentationMode.value || !props.zoomable || !isZoomMode.value) return
    if (props.displayMode === 'independent') {
      const target = event.target instanceof Element ? event.target : null
      const overlay = target?.closest('[data-independent-overlay-index]')
      const trackIndex = Number(overlay?.getAttribute('data-independent-overlay-index'))
      const track = trackLayouts.value.find((item) => item.index === trackIndex)
      if (!track) return
      event.preventDefault()
      resetViewport(trackIndex)
      emit('zoom-reset', {
        trackIndex,
        seriesIds: track.legendSeries.map((series) => series.id),
      })
      return
    }
    event.preventDefault()
    resetViewport()
    emit('zoom-reset', {})
  }
  return {
    selectionBox,
    beginViewportDrag,
    beginSharedViewportDrag,
    updateViewportDrag,
    finishViewportDrag,
    cancelViewportDrag,
    resetViewport,
    setViewportDomain,
    requestViewportReset,
  }
}

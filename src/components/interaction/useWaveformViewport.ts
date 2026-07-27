import { pointer, scaleLinear, zoomIdentity, type ZoomTransform } from 'd3'
import { computed, nextTick, type ComputedRef, type Ref, type ShallowRef } from 'vue'

import { MINIMUM_SELECTION_SIZE } from '../core/constants'
import type { DisplayTrack, TrackLayout } from '../core/types'
import type {
  ResolvedWaveformChartProps,
  ViewportSelectionState,
  WaveformChartEmit,
} from '../core/waveformChartTypes'
import type { AnnotationSeriesCandidate } from '../annotation'

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
    editorSeriesOptions,
    resolveInitialTrackDomain,
    canZoomTrack,
    canZoomSharedTracks,
    configureZoom,
    cancelPendingZoom,
    clearHover,
    resolveTrackAtPointer,
  } = context
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
  const transformForDomain = (
    domain: [number, number],
    baseDomain: [number, number],
    width: number,
  ): ZoomTransform => {
    const baseSpan = baseDomain[1] - baseDomain[0]
    const span = domain[1] - domain[0]
    if (!Number.isFinite(baseSpan) || !Number.isFinite(span) || baseSpan <= 0 || span <= 0) {
      return zoomIdentity
    }
    const scale = baseSpan / span
    const baseScale = scaleLinear(baseDomain, [0, width])
    return zoomIdentity.translate(-scale * baseScale(domain[0]), 0).scale(scale)
  }
  const resolveMinimumZoomSpan = (boundary: [number, number]): number => {
    const boundarySpan = Math.abs(boundary[1] - boundary[0])
    if (!Number.isFinite(boundarySpan) || boundarySpan <= 0) return 0
    const configured = props.minZoomSpan
    if (Number.isFinite(configured) && (configured ?? 0) > 0) {
      return Math.min(boundarySpan, configured as number)
    }
    return boundarySpan / 40
  }
  const constrainZoomDomain = (
    domain: [number, number],
    boundary: [number, number],
  ): [number, number] => {
    const normalizedBoundary: [number, number] =
      boundary[0] <= boundary[1] ? [...boundary] : [boundary[1], boundary[0]]
    const boundarySpan = normalizedBoundary[1] - normalizedBoundary[0]
    if (!Number.isFinite(boundarySpan) || boundarySpan <= 0) return normalizedBoundary
    const requestedStart = Math.min(domain[0], domain[1])
    const requestedEnd = Math.max(domain[0], domain[1])
    const minimumSpan = resolveMinimumZoomSpan(normalizedBoundary)
    const span = Math.max(minimumSpan, Math.min(boundarySpan, requestedEnd - requestedStart))
    const center = (requestedStart + requestedEnd) / 2
    const start = Math.max(
      normalizedBoundary[0],
      Math.min(center - span / 2, normalizedBoundary[1] - span),
    )
    return [start, start + span]
  }
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
    const panRequested = props.pannable && spacePressed.value
    if ((!props.zoomable && !panRequested) || !isZoomMode.value || event.button !== 0) return
    const overlay = event.currentTarget as SVGRectElement
    const track = trackLayouts.value.find((item) => item.index === trackIndex)
    if (!track) return
    const [rawX, rawY] = pointer(event, overlay)
    const x = Math.max(0, Math.min(independent ? track.width : innerWidth.value, rawX))
    const y = Math.max(0, Math.min(independent ? track.height : innerHeight.value, rawY))
    selection.value = {
      trackIndex,
      independent,
      overlay,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      pointerId: event.pointerId,
      mode: panRequested ? 'pan' : 'box',
      xDomain: track.xScale.domain() as [number, number],
      yDomains: currentYDomains(),
    }
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
      const key = target.series.trackId ?? target.series.id
      const source = active.yDomains[key] ?? (target.yScale.domain() as [number, number])
      const boundary = chartTracks.value.find((item) => item.id === key)?.yDomain ?? source
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
    const active = selection.value
    if (!active || event.pointerId !== active.pointerId) return
    const track = trackLayouts.value.find((item) => item.index === active.trackIndex)
    if (!track) return
    const [rawX, rawY] = pointer(event, active.overlay)
    active.currentX = Math.max(
      0,
      Math.min(active.independent ? track.width : innerWidth.value, rawX),
    )
    active.currentY = Math.max(
      0,
      Math.min(active.independent ? track.height : innerHeight.value, rawY),
    )
    selection.value = { ...active }
    if (active.mode === 'pan') applyPan(active, track)
    event.preventDefault()
  }
  const cancelViewportDrag = (event?: PointerEvent) => {
    const active = selection.value
    if (!active || (event && event.pointerId !== active.pointerId)) return
    active.overlay.releasePointerCapture?.(active.pointerId)
    selection.value = null
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
    const xDomain = constrainZoomDomain(
      [track.xScale.invert(left), track.xScale.invert(right)],
      baseXDomain,
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
    const active = selection.value
    if (!active || event.pointerId !== active.pointerId) return
    updateViewportDrag(event)
    active.overlay.releasePointerCapture?.(active.pointerId)
    selection.value = null
    if (active.mode === 'pan') {
      void nextTick(configureZoom)
      return
    }
    if (Math.abs(active.currentX - active.startX) >= MINIMUM_SELECTION_SIZE) {
      applyBoxZoom(active)
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
  const requestViewportReset = (event: MouseEvent) => {
    if (!props.zoomable || !isZoomMode.value) return
    event.preventDefault()
    resetViewport()
    emit('zoom-reset')
  }

  return {
    selectionBox,
    beginViewportDrag,
    beginSharedViewportDrag,
    updateViewportDrag,
    finishViewportDrag,
    cancelViewportDrag,
    resetViewport,
    requestViewportReset,
  }
}

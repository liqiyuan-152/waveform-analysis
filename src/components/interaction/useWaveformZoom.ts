import {
  scaleLinear,
  select,
  zoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomBehavior,
  type ZoomTransform,
} from 'd3'
import type { ComputedRef, ShallowRef } from 'vue'

import { hasMinimumVisibleXValues } from '../../core/rendering'
import { WHEEL_ZOOM_DEBOUNCE_MS, ZOOM_CONSTRAINTS } from '../core/constants'
import type { TrackLayout } from '../core/types'
import type { ResolvedWaveformChartProps, WaveformChartEmit } from '../core/waveformChartTypes'
import { useAnimationFrameThrottle } from '../utils/useAnimationFrameThrottle'

interface ZoomContext {
  props: ResolvedWaveformChartProps
  emit: WaveformChartEmit
  svgElement: ShallowRef<SVGSVGElement | undefined>
  sharedOverlayElement: ShallowRef<SVGRectElement | undefined>
  sharedTransform: ShallowRef<ZoomTransform>
  independentTransforms: ShallowRef<ZoomTransform[]>
  trackLayouts: ComputedRef<TrackLayout[]>
  initialXDomain: ComputedRef<[number, number]>
  sharedZoomDomain: ComputedRef<[number, number]>
  innerWidth: ComputedRef<number>
  innerHeight: ComputedRef<number>
  hasChartArea: ComputedRef<boolean>
  isZoomMode: ComputedRef<boolean>
  resolveInitialTrackDomain: (track: TrackLayout) => [number, number]
  cancelPendingHover: () => void
}

type ZoomGestureKind = 'wheel'

export function useWaveformZoom(context: ZoomContext) {
  const {
    props,
    emit,
    svgElement,
    sharedOverlayElement,
    sharedTransform,
    independentTransforms,
    trackLayouts,
    initialXDomain,
    sharedZoomDomain,
    innerWidth,
    innerHeight,
    hasChartArea,
    isZoomMode,
    resolveInitialTrackDomain,
    cancelPendingHover,
  } = context
  const zoomBehaviors = new Map<number | 'shared', ZoomBehavior<SVGRectElement, unknown>>()
  const zoomThrottle = useAnimationFrameThrottle()
  let synchronizingZoomTransform = false
  let pendingSharedZoomTransform: ZoomTransform | null = null
  let pendingSharedZoomGesture: ZoomGestureKind | null = null
  let lastSharedZoomGesture: ZoomGestureKind | null = null
  const pendingIndependentZoomTransforms = new Map<number, ZoomTransform>()
  const pendingIndependentZoomGestures = new Map<number, ZoomGestureKind>()
  const lastIndependentZoomGestures = new Map<number, ZoomGestureKind>()
  const lastZoomedTrackIndexes = new Set<number>()
  let wheelZoomEndTimer: ReturnType<typeof setTimeout> | undefined

  const scheduleZoomCommit = () => zoomThrottle.schedule(commitPendingZoom)
  const handleSharedZoom = (event: D3ZoomEvent<SVGRectElement, unknown>) => {
    if (synchronizingZoomTransform) return
    cancelPendingHover()
    pendingSharedZoomTransform = event.transform
    pendingSharedZoomGesture = 'wheel'
    scheduleZoomCommit()
    scheduleWheelZoomEnd()
  }
  const handleIndependentZoom = (
    event: D3ZoomEvent<SVGRectElement, unknown>,
    trackIndex: number,
  ) => {
    if (synchronizingZoomTransform) return
    cancelPendingHover()
    pendingIndependentZoomTransforms.set(trackIndex, event.transform)
    pendingIndependentZoomGestures.set(trackIndex, 'wheel')
    scheduleZoomCommit()
    scheduleWheelZoomEnd()
  }
  function commitPendingZoom() {
    if (pendingSharedZoomTransform) {
      const transform = pendingSharedZoomTransform
      pendingSharedZoomTransform = null
      lastSharedZoomGesture = pendingSharedZoomGesture
      pendingSharedZoomGesture = null
      sharedTransform.value = transform
      const domain = transform
        .rescaleX(scaleLinear(initialXDomain.value, [0, innerWidth.value]))
        .domain()
      emit('zoom-change', [domain[0], domain[1]])
    }
    if (!pendingIndependentZoomTransforms.size) return
    const nextTransforms = [...independentTransforms.value]
    const changedTrackIndexes = Array.from(pendingIndependentZoomTransforms.keys())
    lastZoomedTrackIndexes.clear()
    changedTrackIndexes.forEach((trackIndex) => lastZoomedTrackIndexes.add(trackIndex))
    changedTrackIndexes.forEach((trackIndex) => {
      const gesture = pendingIndependentZoomGestures.get(trackIndex)
      if (gesture) lastIndependentZoomGestures.set(trackIndex, gesture)
    })
    pendingIndependentZoomTransforms.forEach((transform, trackIndex) => {
      nextTransforms[trackIndex] = transform
    })
    pendingIndependentZoomTransforms.clear()
    pendingIndependentZoomGestures.clear()
    independentTransforms.value = nextTransforms
    const tracksByIndex = new Map(trackLayouts.value.map((track) => [track.index, track]))
    changedTrackIndexes.forEach((trackIndex) => {
      const track = tracksByIndex.get(trackIndex)
      if (!track) return
      const domain = track.xScale.domain()
      emit('zoom-change', [domain[0], domain[1]])
    })
  }
  const emitZoomEnd = () => {
    if (props.displayMode === 'independent') {
      const tracksByIndex = new Map(trackLayouts.value.map((track) => [track.index, track]))
      lastZoomedTrackIndexes.forEach((trackIndex) => {
        if (lastIndependentZoomGestures.get(trackIndex) !== 'wheel') return
        const track = tracksByIndex.get(trackIndex)
        if (!track) return
        const domain = track.xScale.domain() as [number, number]
        const yDomain = track.yScale.domain()
        emit('zoom-end', {
          start: domain[0],
          end: domain[1],
          yStart: yDomain[0],
          yEnd: yDomain[1],
          trackIndex,
          seriesIds: track.seriesList.map((series) => series.id),
          gesture: 'wheel',
        })
      })
      lastZoomedTrackIndexes.clear()
      lastIndependentZoomGestures.clear()
      return
    }
    if (lastSharedZoomGesture !== 'wheel') {
      lastSharedZoomGesture = null
      return
    }
    const domain = sharedZoomDomain.value
    const visibleTracks = trackLayouts.value.filter((track) => track.hasVisibleSeries)
    if (visibleTracks.length === 1) {
      const yDomain = visibleTracks[0]?.yScale.domain()
      emit('zoom-end', {
        start: domain[0],
        end: domain[1],
        yStart: yDomain?.[0],
        yEnd: yDomain?.[1],
        gesture: 'wheel',
      })
    } else {
      emit('zoom-end', {
        start: domain[0],
        end: domain[1],
        yRanges: Object.fromEntries(
          visibleTracks.map((track) => [
            track.series.trackId ?? track.series.id,
            track.yScale.domain() as [number, number],
          ]),
        ),
        gesture: 'wheel',
      })
    }
    lastSharedZoomGesture = null
  }
  const flushPendingZoom = () => {
    zoomThrottle.flush()
    commitPendingZoom()
    if (lastSharedZoomGesture === 'wheel' || lastIndependentZoomGestures.size) return
    emitZoomEnd()
  }
  function scheduleWheelZoomEnd() {
    if (wheelZoomEndTimer !== undefined) clearTimeout(wheelZoomEndTimer)
    wheelZoomEndTimer = setTimeout(() => {
      wheelZoomEndTimer = undefined
      zoomThrottle.flush()
      commitPendingZoom()
      emitZoomEnd()
    }, WHEEL_ZOOM_DEBOUNCE_MS)
  }
  const cancelPendingZoom = () => {
    pendingSharedZoomTransform = null
    pendingSharedZoomGesture = null
    lastSharedZoomGesture = null
    pendingIndependentZoomTransforms.clear()
    pendingIndependentZoomGestures.clear()
    lastZoomedTrackIndexes.clear()
    lastIndependentZoomGestures.clear()
    zoomThrottle.cancel()
    if (wheelZoomEndTimer !== undefined) {
      clearTimeout(wheelZoomEndTimer)
      wheelZoomEndTimer = undefined
    }
  }
  const clearZoomBindings = () => {
    cancelPendingZoom()
    svgElement.value
      ?.querySelectorAll<SVGRectElement>('.waveform-chart__overlay')
      .forEach((overlay) => select(overlay).on('.zoom', null))
    zoomBehaviors.clear()
  }
  const resolveMaximumZoomScale = (domain: [number, number]): number => {
    const minZoomSpan = props.minZoomSpan
    if (!Number.isFinite(minZoomSpan) || (minZoomSpan ?? 0) <= 0) {
      return ZOOM_CONSTRAINTS.DEFAULT_MAX_SCALE
    }
    const domainSpan = Math.abs(domain[1] - domain[0])
    if (!Number.isFinite(domainSpan) || domainSpan <= 0) return ZOOM_CONSTRAINTS.MIN_SCALE
    return Math.min(
      ZOOM_CONSTRAINTS.DEFAULT_MAX_SCALE,
      Math.max(ZOOM_CONSTRAINTS.MIN_SCALE, domainSpan / (minZoomSpan ?? domainSpan)),
    )
  }
  const canZoomTrack = (track: TrackLayout): boolean =>
    hasMinimumVisibleXValues(
      track.seriesList,
      track.xScale.domain() as [number, number],
      Number(props.minVisiblePoints),
    )
  const canZoomSharedTracks = (): boolean => {
    const tracks = trackLayouts.value.filter((track) => track.hasVisibleSeries)
    return tracks.length > 0 && tracks.every(canZoomTrack)
  }
  const configureZoom = () => {
    clearZoomBindings()
    if (!props.zoomable || !isZoomMode.value || !hasChartArea.value || !trackLayouts.value.length) {
      return
    }
    if (props.displayMode === 'independent') {
      trackLayouts.value.forEach((track) => {
        const overlay = svgElement.value?.querySelector<SVGRectElement>(
          `[data-independent-overlay-index="${track.index}"]`,
        )
        if (!overlay) return
        const dataDomain = resolveInitialTrackDomain(track)
        const behavior = zoom<SVGRectElement, unknown>()
          .filter(
            (event) =>
              event.type === 'wheel' && (event as WheelEvent).deltaY < 0 && canZoomTrack(track),
          )
          .scaleExtent([1, resolveMaximumZoomScale(dataDomain)])
          .extent([
            [0, 0],
            [track.width, track.height],
          ])
          .translateExtent([
            [0, 0],
            [track.width, track.height],
          ])
          .on('zoom', (event) => handleIndependentZoom(event, track.index))
          .on('end', flushPendingZoom)
        zoomBehaviors.set(track.index, behavior)
        synchronizingZoomTransform = true
        try {
          select(overlay)
            .call(behavior)
            .on('dblclick.zoom', null)
            .call(behavior.transform, independentTransforms.value[track.index] ?? zoomIdentity)
        } finally {
          synchronizingZoomTransform = false
        }
      })
      return
    }
    const overlay = sharedOverlayElement.value
    if (!overlay) return
    const behavior = zoom<SVGRectElement, unknown>()
      .filter(
        (event) =>
          event.type === 'wheel' && (event as WheelEvent).deltaY < 0 && canZoomSharedTracks(),
      )
      .scaleExtent([1, resolveMaximumZoomScale(initialXDomain.value)])
      .extent([
        [0, 0],
        [innerWidth.value, innerHeight.value],
      ])
      .translateExtent([
        [0, 0],
        [innerWidth.value, innerHeight.value],
      ])
      .on('zoom', handleSharedZoom)
      .on('end', flushPendingZoom)
    zoomBehaviors.set('shared', behavior)
    synchronizingZoomTransform = true
    try {
      select(overlay)
        .call(behavior)
        .on('dblclick.zoom', null)
        .call(behavior.transform, sharedTransform.value)
    } finally {
      synchronizingZoomTransform = false
    }
  }

  return {
    cancelPendingZoom,
    clearZoomBindings,
    canZoomTrack,
    canZoomSharedTracks,
    configureZoom,
  }
}

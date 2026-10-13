import { pointer, scaleLinear, select, zoomIdentity, zoomTransform, type ZoomTransform } from 'd3'
import type { ComputedRef, ShallowRef } from 'vue'

import { WHEEL_ZOOM_DEBOUNCE_MS } from '../core/constants'
import type { TrackLayout } from '../core/types'
import type { ResolvedWaveformChartProps, WaveformChartEmit } from '../core/waveformChartTypes'
import { useAnimationFrameThrottle } from '../utils/useAnimationFrameThrottle'
import { resolveStepZoomDomain, sameZoomDomain } from './stepZoom'
import { normalizeIntegerZoomDomain } from './integerZoom'
import { transformForDomain, type ZoomSeriesGroup } from './zoomConstraints'
import {
  emitIndependentWheelZoomEnds,
  emitSharedWheelZoomEnd,
  seriesIdentity,
} from './zoomEventPayload'

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
  isPresentationMode: ComputedRef<boolean>
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
    hasChartArea,
    isZoomMode,
    isPresentationMode,
    resolveInitialTrackDomain,
    cancelPendingHover,
  } = context
  const zoomThrottle = useAnimationFrameThrottle()
  let pendingSharedZoomTransform: ZoomTransform | null = null
  let pendingSharedZoomGesture: ZoomGestureKind | null = null
  let lastSharedZoomGesture: ZoomGestureKind | null = null
  const pendingIndependentZoomTransforms = new Map<number, ZoomTransform>()
  const pendingIndependentZoomGestures = new Map<number, ZoomGestureKind>()
  const lastIndependentWheelSeriesIds = new Map<string, string[]>()
  let wheelZoomEndTimer: ReturnType<typeof setTimeout> | undefined
  let preservePendingWheelDuringDataRebind = false

  const scheduleZoomCommit = () => zoomThrottle.schedule(commitPendingZoom)
  const handleSharedZoom = (event: { transform: ZoomTransform }) => {
    if (isPresentationMode.value) return
    cancelPendingHover()
    pendingSharedZoomTransform = event.transform
    pendingSharedZoomGesture = 'wheel'
    scheduleWheelZoomEnd()
    const domain = event.transform
      .rescaleX(scaleLinear(initialXDomain.value, [0, innerWidth.value]))
      .domain()
    const [start, end] = normalizeIntegerZoomDomain(domain as [number, number], props)
    emit('zoom-intent', { start, end, gesture: 'wheel' })
    scheduleZoomCommit()
  }
  const handleIndependentZoom = (event: { transform: ZoomTransform }, trackIndex: number) => {
    if (isPresentationMode.value) return
    cancelPendingHover()
    pendingIndependentZoomTransforms.set(trackIndex, event.transform)
    pendingIndependentZoomGestures.set(trackIndex, 'wheel')
    scheduleWheelZoomEnd()
    const track = trackLayouts.value.find((item) => item.index === trackIndex)
    if (track) {
      const domain = event.transform
        .rescaleX(scaleLinear(resolveInitialTrackDomain(track), [0, track.width]))
        .domain()
      emit('zoom-intent', {
        start: normalizeIntegerZoomDomain(domain as [number, number], props)[0],
        end: normalizeIntegerZoomDomain(domain as [number, number], props)[1],
        trackIndex,
        seriesIds: track.seriesList.map((series) => series.id),
        gesture: 'wheel',
      })
    }
    scheduleZoomCommit()
  }
  function commitPendingZoom() {
    if (isPresentationMode.value) {
      cancelPendingZoom()
      return
    }
    if (pendingSharedZoomTransform) {
      const transform = pendingSharedZoomTransform
      pendingSharedZoomTransform = null
      lastSharedZoomGesture = pendingSharedZoomGesture
      pendingSharedZoomGesture = null
      sharedTransform.value = transform
      const domain = transform
        .rescaleX(scaleLinear(initialXDomain.value, [0, innerWidth.value]))
        .domain()
      emit('zoom-change', normalizeIntegerZoomDomain([domain[0], domain[1]], props))
    }
    if (!pendingIndependentZoomTransforms.size) return
    const nextTransforms = [...independentTransforms.value]
    const changedTrackIndexes = Array.from(pendingIndependentZoomTransforms.keys())
    const changedGestures = new Map(pendingIndependentZoomGestures)
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
      if (changedGestures.get(trackIndex) === 'wheel') {
        const seriesIds = track.seriesList.map((series) => series.id)
        lastIndependentWheelSeriesIds.set(seriesIdentity(seriesIds), seriesIds)
      }
      const domain = track.xScale.domain()
      emit('zoom-change', [domain[0], domain[1]])
    })
  }
  const emitZoomEnd = () => {
    if (props.displayMode === 'independent') {
      emitIndependentWheelZoomEnds(emit, trackLayouts.value, lastIndependentWheelSeriesIds.values())
      lastIndependentWheelSeriesIds.clear()
      return
    }
    if (lastSharedZoomGesture !== 'wheel') {
      lastSharedZoomGesture = null
      return
    }
    emitSharedWheelZoomEnd(emit, sharedZoomDomain.value, trackLayouts.value)
    lastSharedZoomGesture = null
  }
  function scheduleWheelZoomEnd() {
    if (wheelZoomEndTimer !== undefined) clearTimeout(wheelZoomEndTimer)
    wheelZoomEndTimer = setTimeout(() => {
      wheelZoomEndTimer = undefined
      zoomThrottle.flush()
      commitPendingZoom()
      emitZoomEnd()
      preservePendingWheelDuringDataRebind = false
    }, WHEEL_ZOOM_DEBOUNCE_MS)
  }
  const prepareForDataChange = () => {
    if (wheelZoomEndTimer === undefined) return
    zoomThrottle.flush()
    commitPendingZoom()
    preservePendingWheelDuringDataRebind = true
  }
  const cancelPendingZoom = () => {
    pendingSharedZoomTransform = null
    pendingSharedZoomGesture = null
    lastSharedZoomGesture = null
    pendingIndependentZoomTransforms.clear()
    pendingIndependentZoomGestures.clear()
    lastIndependentWheelSeriesIds.clear()
    zoomThrottle.cancel()
    preservePendingWheelDuringDataRebind = false
    if (wheelZoomEndTimer !== undefined) {
      clearTimeout(wheelZoomEndTimer)
      wheelZoomEndTimer = undefined
    }
  }
  const clearZoomBindings = (preservePendingWheel = false) => {
    if (!preservePendingWheel) cancelPendingZoom()
    svgElement.value
      ?.querySelectorAll<SVGRectElement>('.waveform-chart__overlay')
      .forEach((overlay) => select(overlay).on('.zoom', null))
  }
  const bindWheelZoom = (
    overlay: SVGRectElement,
    baseDomain: [number, number],
    width: number,
    groups: readonly ZoomSeriesGroup[],
    transform: ZoomTransform,
    trackIndex?: number,
  ) => {
    select(overlay)
      .property('__zoom', transform)
      .on(
        'wheel.zoom',
        (event: WheelEvent) => {
          if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return
          const current = zoomTransform(overlay)
            .rescaleX(scaleLinear(baseDomain, [0, width]))
            .domain() as [number, number]
          const next = resolveStepZoomDomain(
            current,
            event.deltaY < 0 ? 'zoom-in' : 'zoom-out',
            baseDomain,
            groups,
            props,
            pointer(event, overlay)[0] / width,
          )
          if (sameZoomDomain(current, next)) return
          event.preventDefault()
          event.stopImmediatePropagation()
          const transform = transformForDomain(next, baseDomain, width)
          select(overlay).property('__zoom', transform)
          if (trackIndex === undefined) handleSharedZoom({ transform })
          else handleIndependentZoom({ transform }, trackIndex)
        },
        { passive: false },
      )
  }
  const configureZoom = () => {
    const preservePendingWheel = preservePendingWheelDuringDataRebind
    clearZoomBindings(preservePendingWheel)
    if (
      isPresentationMode.value ||
      !props.zoomable ||
      !isZoomMode.value ||
      !hasChartArea.value ||
      !trackLayouts.value.length
    ) {
      return
    }
    if (props.displayMode === 'independent') {
      trackLayouts.value.forEach((track) => {
        const overlay = svgElement.value?.querySelector<SVGRectElement>(
          `[data-independent-overlay-index="${track.index}"]`,
        )
        if (!overlay) return
        const dataDomain = resolveInitialTrackDomain(track)
        const groups = [track.seriesList]
        bindWheelZoom(
          overlay,
          dataDomain,
          track.width,
          groups,
          independentTransforms.value[track.index] ?? zoomIdentity,
          track.index,
        )
      })
      return
    }
    const overlay = sharedOverlayElement.value
    if (!overlay) return
    const groups = trackLayouts.value
      .filter((track) => track.hasVisibleSeries)
      .map((track) => track.seriesList)
    bindWheelZoom(overlay, initialXDomain.value, innerWidth.value, groups, sharedTransform.value)
  }

  return {
    cancelPendingZoom,
    clearZoomBindings,
    configureZoom,
    prepareForDataChange,
  }
}

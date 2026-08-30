import { pointer } from 'd3'
import type { ComputedRef, Ref, ShallowRef } from 'vue'

import type { WaveformPoint } from '../data/types'
import { pointSourceFromPoints } from '../../core/waveformPointSource'
import type {
  DisplaySeries,
  HoveredSeriesPoint,
  TrackLayout,
  WaveformHoverState,
} from '../core/types'
import type { ViewportSelectionState, WaveformChartEmit } from '../core/waveformChartTypes'
import type { useAnimationFrameThrottle } from '../utils/useAnimationFrameThrottle'

interface HoverContext {
  emit: WaveformChartEmit
  hoverState: WaveformHoverState
  suppressHoverUntilMove: Ref<boolean>
  hoverThrottle: ReturnType<typeof useAnimationFrameThrottle>
  selection: Ref<ViewportSelectionState | null>
  trackLayouts: ComputedRef<TrackLayout[]>
  innerWidth: ComputedRef<number>
  resolvedChartLeftMargin: ComputedRef<number>
  titleAreaHeight: ComputedRef<number>
  chartTopMargin: ComputedRef<number>
  sharedOverlayElement: ShallowRef<SVGRectElement | undefined>
  isPresentationMode: ComputedRef<boolean>
  updateViewportDrag: (event: PointerEvent) => void
  resolveTrackAtPointer: (pointerX: number, pointerY: number) => TrackLayout | undefined
}

export function useWaveformHover(context: HoverContext) {
  const {
    emit,
    hoverState,
    suppressHoverUntilMove,
    hoverThrottle,
    selection,
    trackLayouts,
    innerWidth,
    resolvedChartLeftMargin,
    titleAreaHeight,
    chartTopMargin,
    sharedOverlayElement,
    isPresentationMode,
    updateViewportDrag,
    resolveTrackAtPointer,
  } = context
  const cancelPendingHover = () => hoverThrottle.cancel()
  const scheduleHover = (update: () => void) => hoverThrottle.schedule(update)
  const hoveredPointsMatch = (nextPoints: HoveredSeriesPoint[]): boolean =>
    hoverState.points.length === nextPoints.length &&
    nextPoints.every((point, index) => {
      const current = hoverState.points[index]
      return (
        current?.id === point.id &&
        current.trackIndex === point.trackIndex &&
        current.point === point.point
      )
    })
  const commitHover = (
    nextPoints: HoveredSeriesPoint[],
    trackIndex: number | null,
    queryX: number,
    position: { x: number; y: number },
  ) => {
    if (isPresentationMode.value) return
    if (!hoveredPointsMatch(nextPoints)) hoverState.points = nextPoints
    hoverState.trackIndex = trackIndex
    hoverState.queryX = queryX
    hoverState.position = position
    emit('point-hover', hoverState.points.find((point) => point.point)?.point ?? null)
  }
  const clearHover = () => {
    cancelPendingHover()
    hoverState.points = []
    hoverState.trackIndex = null
    hoverState.queryX = null
    emit('point-hover', null)
  }
  const handlePointerLeave = () => {
    if (!isPresentationMode.value) clearHover()
  }
  const createHoveredSeriesPoint = (
    series: DisplaySeries,
    trackIndex: number,
    point: WaveformPoint | null,
  ): HoveredSeriesPoint => ({
    id: series.id,
    shotNo: series.shotNo,
    name: series.name,
    color: series.color,
    unit: series.unit,
    trackIndex,
    point,
  })
  const beginAnnotationDrag = () => {
    suppressHoverUntilMove.value = true
    clearHover()
  }
  const endAnnotationDrag = (cancelled = false) => {
    suppressHoverUntilMove.value = !cancelled
    clearHover()
  }
  const consumeHoverSuppression = (): boolean => {
    if (!suppressHoverUntilMove.value) return false
    suppressHoverUntilMove.value = false
    clearHover()
    return true
  }
  const nearestPoint = (series: DisplaySeries, xValue: number): WaveformPoint | undefined => {
    const source = series.source ?? pointSourceFromPoints(series.points)
    const first = source.pointAt(0)
    const last = source.pointAt(source.length - 1)
    if (!first || !last || xValue < first.x || xValue > last.x) return undefined
    return source.nearestPoint(xValue)
  }

  const handleIndependentPointerMove = (event: PointerEvent, trackIndex: number) => {
    if (isPresentationMode.value) return
    if (selection.value?.trackIndex === trackIndex && selection.value.independent) {
      updateViewportDrag(event)
      return
    }
    if (consumeHoverSuppression()) return
    const overlay = event.currentTarget as SVGRectElement | null
    if (!overlay) return
    const [pointerX, pointerY] = pointer(event, overlay)
    const track = trackLayouts.value[trackIndex]
    if (!track || !track.hasVisibleSeries) return
    scheduleHover(() => {
      const currentTrack = trackLayouts.value[trackIndex]
      if (!currentTrack || !currentTrack.hasVisibleSeries || currentTrack !== track) return
      const xValue = track.xScale.invert(Math.max(0, Math.min(innerWidth.value, pointerX)))
      const nextPoints = track.seriesList.map((series) =>
        createHoveredSeriesPoint(series, trackIndex, nearestPoint(series, xValue) ?? null),
      )
      commitHover(nextPoints, trackIndex, xValue, {
        x: resolvedChartLeftMargin.value + track.left + pointerX,
        y: titleAreaHeight.value + chartTopMargin.value + track.top + pointerY,
      })
    })
  }
  const handleSharedPointerMove = (event: PointerEvent) => {
    if (isPresentationMode.value) return
    if (selection.value && !selection.value.independent) {
      updateViewportDrag(event)
      return
    }
    if (consumeHoverSuppression()) return
    if (!sharedOverlayElement.value || !trackLayouts.value.length) return
    const [pointerX, pointerY] = pointer(event, sharedOverlayElement.value)
    scheduleHover(() => {
      const resolvedTrack = resolveTrackAtPointer(pointerX, pointerY)
      const referenceTrack =
        (resolvedTrack?.hasVisibleSeries ? resolvedTrack : undefined) ??
        trackLayouts.value.find((track) => track.hasVisibleSeries)
      if (!referenceTrack) return
      const localPointerX = Math.max(
        0,
        Math.min(referenceTrack.width, pointerX - referenceTrack.left),
      )
      const xValue = referenceTrack.xScale.invert(localPointerX)
      const nextPoints = trackLayouts.value.flatMap((track) =>
        track.seriesList.map((series) =>
          createHoveredSeriesPoint(series, track.index, nearestPoint(series, xValue) ?? null),
        ),
      )
      commitHover(nextPoints, null, xValue, {
        x: resolvedChartLeftMargin.value + pointerX,
        y: titleAreaHeight.value + chartTopMargin.value + pointerY,
      })
    })
  }

  return {
    cancelPendingHover,
    clearHover,
    handlePointerLeave,
    beginAnnotationDrag,
    endAnnotationDrag,
    handleIndependentPointerMove,
    handleSharedPointerMove,
  }
}

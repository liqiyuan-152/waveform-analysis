import { pointer, type ScaleLinear } from 'd3'
import { ref, type ComputedRef, type Ref } from 'vue'

import type { WaveformAnnotation, WaveformInteractionMode } from '../data/types'
import { findClosestTrackAtPointer } from '../core/layout'
import type { DisplaySeries, TrackLayout } from '../core/types'
import type { ResolvedWaveformChartProps, WaveformChartEmit } from '../core/waveformChartTypes'
import {
  ANNOTATION_AMBIGUITY_DISTANCE,
  ANNOTATION_HIT_RADIUS,
  findAnnotationSeriesCandidates,
  findNearestPointByX,
} from './markup'
import type {
  AnnotationEditorAnchor,
  AnnotationHit,
  AnnotationSeriesCandidate,
  AnnotationTrackLayout,
} from './types'
import type { useWaveformAnnotationInteraction } from './useWaveformAnnotationInteraction'

interface AnnotationContext {
  props: ResolvedWaveformChartProps
  emit: WaveformChartEmit
  container: Ref<HTMLDivElement | undefined>
  chartSeries: ComputedRef<DisplaySeries[]>
  hiddenSeriesIdSet: ComputedRef<Set<string>>
  internalHiddenSeriesIds: Ref<Set<string>>
  annotationInteraction: ReturnType<typeof useWaveformAnnotationInteraction>
  editorSeriesOptions: Ref<AnnotationSeriesCandidate[]>
  trackLayouts: ComputedRef<TrackLayout[]>
  annotationLayoutsForTrack: (track: TrackLayout) => AnnotationTrackLayout[]
  resolveSeriesYScale: (track: TrackLayout, seriesId: string) => ScaleLinear<number, number>
  chartWidth: ComputedRef<number>
  chartHeight: ComputedRef<number>
  innerWidth: ComputedRef<number>
  resolvedChartLeftMargin: ComputedRef<number>
  titleAreaHeight: ComputedRef<number>
  chartTopMargin: ComputedRef<number>
  activeInteractionMode: ComputedRef<WaveformInteractionMode | undefined>
  isPresentationMode: ComputedRef<boolean>
}

interface AnnotationCandidateContext {
  candidates: AnnotationSeriesCandidate[]
  editorAnchor: AnnotationEditorAnchor
}

let generatedAnnotationId = 0

function makeAnnotationId(): string {
  generatedAnnotationId += 1
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `annotation-${Date.now()}-${generatedAnnotationId}`
}

export function useWaveformChartAnnotations(context: AnnotationContext) {
  const {
    props,
    emit,
    container,
    chartSeries,
    hiddenSeriesIdSet,
    internalHiddenSeriesIds,
    annotationInteraction,
    editorSeriesOptions,
    trackLayouts,
    annotationLayoutsForTrack,
    resolveSeriesYScale,
    chartWidth,
    chartHeight,
    innerWidth,
    resolvedChartLeftMargin,
    titleAreaHeight,
    chartTopMargin,
    activeInteractionMode,
    isPresentationMode,
  } = context
  const timeError = ref('')

  function toggleSeriesVisibility(seriesId: string) {
    if (!chartSeries.value.some((series) => series.id === seriesId)) return
    const nextHiddenSeriesIds = new Set(hiddenSeriesIdSet.value)
    const visible = nextHiddenSeriesIds.has(seriesId)
    if (visible) nextHiddenSeriesIds.delete(seriesId)
    else nextHiddenSeriesIds.add(seriesId)
    const ids = Array.from(nextHiddenSeriesIds)
    if (props.hiddenSeriesIds === undefined) internalHiddenSeriesIds.value = nextHiddenSeriesIds
    emit('update:hidden-series-ids', ids)
    emit('series-visibility-change', { seriesId, visible, hiddenSeriesIds: ids })
  }

  function resolvePointerEditorAnchor(
    event: MouseEvent,
    trackIndex?: number,
  ): AnnotationEditorAnchor {
    const overlay = event.currentTarget as SVGRectElement | null
    if (!overlay) return { x: chartWidth.value / 2, y: chartHeight.value / 2 }
    const [pointerX, pointerY] = pointer(event, overlay)
    const track = trackIndex === undefined ? undefined : trackLayouts.value[trackIndex]
    return {
      x: resolvedChartLeftMargin.value + (track ? track.left + pointerX : pointerX),
      y: titleAreaHeight.value + chartTopMargin.value + (track ? track.top + pointerY : pointerY),
    }
  }

  function resolveAnnotationEditorAnchor(annotation: WaveformAnnotation): AnnotationEditorAnchor {
    const track = trackLayouts.value.find((item) =>
      item.seriesList.some((series) => series.id === annotation.seriesId),
    )
    return {
      x: track
        ? resolvedChartLeftMargin.value + track.left + track.xScale(annotation.x)
        : chartWidth.value / 2,
      y: track
        ? titleAreaHeight.value +
          chartTopMargin.value +
          track.top +
          resolveSeriesYScale(track, annotation.seriesId)(annotation.y)
        : chartHeight.value / 2,
    }
  }

  function beginCreate(
    hit: AnnotationHit,
    anchor: AnnotationEditorAnchor,
    candidates: AnnotationSeriesCandidate[],
  ) {
    timeError.value = ''
    annotationInteraction.openCreate(hit, makeAnnotationId, anchor)
    editorSeriesOptions.value = candidates
    const draft = annotationInteraction.editorDraft.value
    const track = trackLayouts.value.find((item) => item.index === hit.trackIndex)
    const series = track?.seriesList.find((item) => item.id === hit.seriesId)
    if (draft?.mode === 'add') {
      draft.annotation.style = {
        borderColor: series?.color || '#1677ff',
        textColor: '#333333',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
      }
    }
  }
  function changeDraftSeries(seriesId: string) {
    if (isPresentationMode.value) return
    const draft = annotationInteraction.editorDraft.value
    const candidate = editorSeriesOptions.value.find((item) => item.seriesId === seriesId)
    const track = trackLayouts.value.find((item) =>
      item.seriesList.some((series) => series.id === seriesId),
    )
    const series = track?.seriesList.find((item) => item.id === seriesId)
    const validPoints = series?.points.filter(
      (item) => Number.isFinite(item.x) && Number.isFinite(item.y),
    )
    const point = validPoints && draft ? findNearestPointByX(validPoints, draft.annotation.x) : null
    if (!draft || !candidate || !track || !validPoints?.length) {
      timeError.value = '当前波形没有有效数据'
      return
    }
    if (draft.annotation.x < validPoints[0].x || draft.annotation.x > validPoints.at(-1)!.x) {
      timeError.value = '时间超出当前波形范围'
      return
    }
    timeError.value = ''
    draft.annotation = {
      ...draft.annotation,
      seriesId,
      y: point!.y,
      style: { ...draft.annotation.style, borderColor: candidate.color },
    }
  }
  function changeDraftTime(displayValue: string) {
    if (isPresentationMode.value) return
    const draft = annotationInteraction.editorDraft.value
    const displayTime = Number(displayValue)
    if (!draft || !Number.isFinite(displayTime)) {
      timeError.value = '请输入有效的时间'
      return
    }
    const rawTime = props.timeUnit === 'ms' ? displayTime / 1000 : displayTime
    const track = trackLayouts.value.find((item) =>
      item.seriesList.some((series) => series.id === draft.annotation.seriesId),
    )
    const series = track?.seriesList.find((item) => item.id === draft.annotation.seriesId)
    const validPoints = series?.points.filter(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    )
    if (!validPoints?.length) {
      timeError.value = '当前波形没有有效数据'
      return
    }
    const firstX = validPoints[0].x
    const lastX = validPoints[validPoints.length - 1].x
    if (rawTime < firstX || rawTime > lastX) {
      timeError.value = '时间超出当前波形范围'
      return
    }
    const point = findNearestPointByX(validPoints, rawTime)!
    timeError.value = ''
    draft.annotation = { ...draft.annotation, x: point.x, y: point.y }
  }
  function cancelAnnotation() {
    timeError.value = ''
    annotationInteraction.closeEditor()
    editorSeriesOptions.value = []
  }
  function resolveTrackAtPointer(
    pointerX: number,
    pointerY: number,
    trackIndex?: number,
  ): TrackLayout | undefined {
    if (trackIndex !== undefined) {
      const track = trackLayouts.value[trackIndex]
      return track?.hasVisibleSeries ? track : undefined
    }
    const visibleTracks = trackLayouts.value.filter((track) => track.hasVisibleSeries)
    return findClosestTrackAtPointer(visibleTracks, pointerX, pointerY)
  }

  function resolveAnnotationCandidates(
    event: MouseEvent,
    trackIndex?: number,
  ): AnnotationCandidateContext | null {
    const overlay = event.currentTarget as SVGRectElement | null
    if (!overlay || !trackLayouts.value.length) return null
    const [pointerX, pointerY] = pointer(event, overlay)
    const sharedPointerY =
      trackIndex === undefined ? pointerY : pointerY + (trackLayouts.value[trackIndex]?.top ?? 0)
    const referenceTrack = resolveTrackAtPointer(pointerX, sharedPointerY, trackIndex)
    if (!referenceTrack) return null
    const clampedX = Math.max(0, Math.min(innerWidth.value, pointerX))
    const localPointerX = Math.max(
      0,
      Math.min(referenceTrack.width, clampedX - referenceTrack.left),
    )
    const xValue = referenceTrack.xScale.invert(localPointerX)
    return {
      candidates: findAnnotationSeriesCandidates(
        annotationLayoutsForTrack(referenceTrack),
        xValue,
        localPointerX,
        sharedPointerY,
      ),
      editorAnchor: resolvePointerEditorAnchor(event, trackIndex),
    }
  }

  function nearbyCandidates(candidates: AnnotationSeriesCandidate[]): AnnotationSeriesCandidate[] {
    const closest = candidates[0]
    if (!closest || closest.distance > ANNOTATION_HIT_RADIUS) return []
    return candidates.filter(
      (candidate) =>
        candidate.distance <= ANNOTATION_HIT_RADIUS &&
        candidate.distance - closest.distance < ANNOTATION_AMBIGUITY_DISTANCE,
    )
  }

  function handleAnnotationClick(event: MouseEvent, trackIndex?: number) {
    if (
      isPresentationMode.value ||
      !props.annotationsVisible ||
      activeInteractionMode.value !== 'annotation'
    ) {
      return
    }
    const candidateContext = resolveAnnotationCandidates(event, trackIndex)
    if (!candidateContext) return
    const nearby = nearbyCandidates(candidateContext.candidates)
    if (!nearby.length) return
    event.preventDefault()
    event.stopPropagation()
    beginCreate(nearby[0], candidateContext.editorAnchor, candidateContext.candidates)
  }

  function handleNativeContextMenu(event: MouseEvent) {
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')
    ) {
      return
    }
    event.preventDefault()
  }

  function handleAnnotationContextMenu(event: MouseEvent, trackIndex?: number) {
    if (isPresentationMode.value || !props.annotationsVisible) return
    event.preventDefault()
    event.stopPropagation()
    const candidateContext = resolveAnnotationCandidates(event, trackIndex)
    if (!candidateContext || !candidateContext.candidates.length) return
    const nearby = nearbyCandidates(candidateContext.candidates)
    beginCreate(
      nearby[0] ?? candidateContext.candidates[0],
      candidateContext.editorAnchor,
      candidateContext.candidates,
    )
  }

  function handleExistingAnnotationContextMenu(annotationId: string, event: MouseEvent) {
    if (isPresentationMode.value || !props.annotationsVisible || !container.value) return
    editorSeriesOptions.value = []
    const annotation = props.annotations.find((item) => item.id === annotationId)
    if (!annotation) return
    const bounds = container.value.getBoundingClientRect()
    const editorAnchor = {
      x: Math.max(0, Math.min(event.clientX - bounds.left, chartWidth.value)),
      y: Math.max(0, Math.min(event.clientY - bounds.top, chartHeight.value)),
    }
    annotationInteraction.openContextMenu({
      annotationId,
      x: Math.max(4, Math.min(event.clientX - bounds.left, chartWidth.value - 120)),
      y: Math.max(4, Math.min(event.clientY - bounds.top, chartHeight.value - 110)),
      editorAnchor,
    })
  }

  function handleAnnotationMove(annotationId: string, offsetX: number, offsetY: number) {
    if (isPresentationMode.value) return
    const annotation = props.annotations.find((item) => item.id === annotationId)
    if (!annotation || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return
    emit(
      'update:annotations',
      props.annotations.map((item) =>
        item.id === annotationId ? { ...item, labelOffsetX: offsetX, labelOffsetY: offsetY } : item,
      ),
    )
  }

  function editContextAnnotation() {
    if (isPresentationMode.value) return
    timeError.value = ''
    const menu = annotationInteraction.contextMenu.value
    const annotation = props.annotations.find((item) => item.id === menu?.annotationId)
    if (!annotation) return
    const track = trackLayouts.value.find((item) =>
      item.seriesList.some((series) => series.id === annotation.seriesId),
    )
    editorSeriesOptions.value = track
      ? findAnnotationSeriesCandidates(
          annotationLayoutsForTrack(track),
          annotation.x,
          track.xScale(annotation.x),
          track.top + resolveSeriesYScale(track, annotation.seriesId)(annotation.y),
        )
      : []
    annotationInteraction.openEdit(
      annotation,
      menu?.editorAnchor ?? resolveAnnotationEditorAnchor(annotation),
    )
  }

  function deleteContextAnnotation() {
    if (isPresentationMode.value) return
    const annotationId = annotationInteraction.contextMenu.value?.annotationId
    const annotation = props.annotations.find((item) => item.id === annotationId)
    if (!annotation) return
    emit(
      'update:annotations',
      props.annotations.filter((item) => item.id !== annotation.id),
    )
    emit('annotation-delete', annotation)
    annotationInteraction.closeContextMenu()
  }

  function confirmAnnotation(annotation: WaveformAnnotation) {
    if (isPresentationMode.value) return
    const draft = annotationInteraction.editorDraft.value
    if (!draft || timeError.value) return
    if (draft.mode === 'add') {
      emit('update:annotations', [...props.annotations, annotation])
      emit('annotation-create', annotation)
    } else {
      emit(
        'update:annotations',
        props.annotations.map((item) => (item.id === annotation.id ? annotation : item)),
      )
      emit('annotation-update', annotation, draft.previous)
    }
    cancelAnnotation()
  }

  return {
    toggleSeriesVisibility,
    changeDraftSeries,
    changeDraftTime,
    timeError,
    cancelAnnotation,
    resolveTrackAtPointer,
    handleAnnotationClick,
    handleNativeContextMenu,
    handleAnnotationContextMenu,
    handleExistingAnnotationContextMenu,
    handleAnnotationMove,
    editContextAnnotation,
    deleteContextAnnotation,
    confirmAnnotation,
  }
}

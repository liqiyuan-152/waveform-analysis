import { zoomIdentity, type ZoomTransform } from 'd3'
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  watch,
  type ComputedRef,
  type Ref,
  type ShallowRef,
} from 'vue'

import type { AnnotationSeriesCandidate } from '../annotation'
import type { useWaveformAnnotationInteraction } from '../annotation'
import type { DisplaySeries, DisplayTrack, TrackLayout } from './types'
import type { ResolvedWaveformChartProps, WaveformChartEmit } from './waveformChartTypes'
import { constrainZoomDomain, transformForDomain } from '../interaction/zoomConstraints'

interface LifecycleContext {
  props: ResolvedWaveformChartProps
  emit: WaveformChartEmit
  container: Ref<HTMLDivElement | undefined>
  titleMeasureElement: Ref<HTMLSpanElement | undefined>
  resizeObserver: ShallowRef<ResizeObserver | undefined>
  observedWidth: Ref<number>
  observedHeight: Ref<number>
  measuredTitleWidth: Ref<number>
  measuredTitleHeight: Ref<number>
  resolvedTitleText: ComputedRef<string>
  titleAreaReserved: ComputedRef<boolean>
  titleMeasureStyle: ComputedRef<object>
  spacePressed: Ref<boolean>
  pointerInsideChart: Ref<boolean>
  currentPage: Ref<number>
  pageCount: ComputedRef<number>
  pagedTracks: ComputedRef<Array<DisplayTrack | undefined>>
  gridOptions: ComputedRef<{ rowCount: number; columnCount: number }>
  chartSeries: ComputedRef<DisplaySeries[]>
  chartTracks: ComputedRef<DisplayTrack[]>
  trackLayouts: ComputedRef<TrackLayout[]>
  innerWidth: ComputedRef<number>
  innerHeight: ComputedRef<number>
  sharedZoomDomain: ComputedRef<[number, number]>
  initialXDomain: ComputedRef<[number, number]>
  sharedTransform: ShallowRef<ZoomTransform>
  activeInteractionMode: ComputedRef<string | undefined>
  hiddenSeriesIdSet: ComputedRef<Set<string>>
  internalHiddenSeriesIds: Ref<Set<string>>
  independentTransforms: ShallowRef<ZoomTransform[]>
  independentYDomains: Ref<Record<number, [number, number]>>
  resolveInitialTrackDomain: (track: TrackLayout) => [number, number]
  annotationInteraction: ReturnType<typeof useWaveformAnnotationInteraction>
  editorSeriesOptions: Ref<AnnotationSeriesCandidate[]>
  isPresentationMode: ComputedRef<boolean>
  clearHover: () => void
  cancelAnnotation: () => void
  configureZoom: () => void
  resetViewport: () => void
  cancelViewportDrag: () => void
  cancelPendingHover: () => void
  clearZoomBindings: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'button, input, select, textarea, [contenteditable]:not([contenteditable="false"])',
      ),
    )
  )
}

export function useWaveformChartLifecycle(context: LifecycleContext) {
  const {
    props,
    emit,
    container,
    titleMeasureElement,
    resizeObserver,
    observedWidth,
    observedHeight,
    measuredTitleWidth,
    measuredTitleHeight,
    resolvedTitleText,
    titleAreaReserved,
    titleMeasureStyle,
    spacePressed,
    pointerInsideChart,
    currentPage,
    pageCount,
    pagedTracks,
    gridOptions,
    chartSeries,
    chartTracks,
    trackLayouts,
    innerWidth,
    innerHeight,
    sharedZoomDomain,
    initialXDomain,
    sharedTransform,
    activeInteractionMode,
    hiddenSeriesIdSet,
    internalHiddenSeriesIds,
    independentTransforms,
    independentYDomains,
    resolveInitialTrackDomain,
    annotationInteraction,
    editorSeriesOptions,
    isPresentationMode,
    clearHover,
    cancelAnnotation,
    configureZoom,
    resetViewport,
    cancelViewportDrag,
    cancelPendingHover,
    clearZoomBindings,
  } = context

  function handleInteractionKeyDown(event: KeyboardEvent) {
    if (
      isPresentationMode.value ||
      event.code !== 'Space' ||
      !props.pannable ||
      !pointerInsideChart.value
    ) {
      return
    }
    if (isEditableTarget(event.target)) return
    spacePressed.value = true
    event.preventDefault()
  }

  function handleInteractionKeyUp(event: KeyboardEvent) {
    if (event.code === 'Space') spacePressed.value = false
  }

  function goToPage(page: number) {
    const nextPage = Math.min(pageCount.value, Math.max(1, Math.floor(page)))
    if (nextPage === currentPage.value) return
    currentPage.value = nextPage
    clearHover()
    annotationInteraction.closeContextMenu()
    cancelAnnotation()
    if (props.displayMode === 'independent') {
      independentTransforms.value = pagedTracks.value.map(() => zoomIdentity)
      independentYDomains.value = {}
    }
    void nextTick(configureZoom)
    emit('page-change', nextPage, pageCount.value)
  }

  let pendingSharedXDomain: [number, number] | undefined
  let pendingIndependentXDomains: Array<[number, number] | undefined> | undefined

  function handleBeforeDataReferenceChange() {
    if (props.displayMode === 'independent') {
      pendingSharedXDomain = undefined
      pendingIndependentXDomains = trackLayouts.value.map((track) => {
        const current = track.xScale.domain() as [number, number]
        const boundary = resolveInitialTrackDomain(track)
        return current[1] - current[0] < boundary[1] - boundary[0] - 1e-12 ? current : undefined
      })
      return
    }
    pendingIndependentXDomains = undefined
    const current = sharedZoomDomain.value
    const boundary = initialXDomain.value
    pendingSharedXDomain =
      current[1] - current[0] < boundary[1] - boundary[0] - 1e-12 ? [...current] : undefined
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
          const previousDomain = pendingIndependentXDomains?.[track.index]
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

  watch(
    [
      innerWidth,
      innerHeight,
      () => props.zoomable,
      isPresentationMode,
      () => props.minZoomSpan,
      () => props.minVisiblePoints,
      () => props.initialXDomain,
      () => props.initialXDomains,
      () => props.xDomainStrategy,
      () => props.displayMode,
      () => chartTracks.value.length,
      currentPage,
      () => gridOptions.value.rowCount,
      () => gridOptions.value.columnCount,
      activeInteractionMode,
    ],
    async () => {
      await nextTick()
      configureZoom()
    },
    { immediate: true },
  )

  watch(
    () => props.displayMode,
    () => {
      const previousPage = currentPage.value
      currentPage.value = 1
      resetViewport()
      if (previousPage !== 1) emit('page-change', 1, pageCount.value)
    },
  )

  watch([pageCount, () => props.grid?.rowCount, () => props.grid?.columnCount], () => {
    const previousPage = currentPage.value
    currentPage.value =
      currentPage.value > pageCount.value
        ? pageCount.value
        : currentPage.value !== 1
          ? 1
          : currentPage.value
    if (previousPage !== currentPage.value) {
      emit('page-change', currentPage.value, pageCount.value)
    }
    clearHover()
    void nextTick(configureZoom)
  })

  watch(activeInteractionMode, () => {
    editorSeriesOptions.value = []
  })

  watch(isPresentationMode, (enabled) => {
    spacePressed.value = false
    if (!enabled) return
    cancelViewportDrag()
    clearZoomBindings()
    clearHover()
    annotationInteraction.closeContextMenu()
    cancelAnnotation()
  })

  watch(
    () => chartSeries.value.map((series) => series.id).join('\u0000'),
    () => {
      if (props.hiddenSeriesIds !== undefined) return
      const availableIds = new Set(chartSeries.value.map((series) => series.id))
      const retainedIds = new Set(
        Array.from(internalHiddenSeriesIds.value).filter((seriesId) => availableIds.has(seriesId)),
      )
      if (
        retainedIds.size !== internalHiddenSeriesIds.value.size ||
        Array.from(internalHiddenSeriesIds.value).some((seriesId) => !retainedIds.has(seriesId))
      ) {
        internalHiddenSeriesIds.value = retainedIds
      }
    },
    { immediate: true },
  )

  watch(
    () =>
      chartTracks.value
        .flatMap((track) => track.visibleSeries.map((series) => series.id))
        .join('\u0000'),
    () => {
      clearHover()
      editorSeriesOptions.value = []
      const draftSeriesId = annotationInteraction.editorDraft.value?.annotation.seriesId
      if (
        draftSeriesId &&
        (!chartSeries.value.some((series) => series.id === draftSeriesId) ||
          hiddenSeriesIdSet.value.has(draftSeriesId))
      ) {
        annotationInteraction.closeEditor()
      }
      const contextAnnotationId = annotationInteraction.contextMenu.value?.annotationId
      const contextAnnotation = props.annotations.find((item) => item.id === contextAnnotationId)
      if (contextAnnotation && hiddenSeriesIdSet.value.has(contextAnnotation.seriesId)) {
        annotationInteraction.closeContextMenu()
      }
      void nextTick(configureZoom)
    },
  )

  watch(
    () => props.annotationsVisible,
    (visible) => {
      if (!visible) {
        annotationInteraction.closeContextMenu()
        cancelAnnotation()
      }
    },
  )

  watch(
    () => props.annotations,
    (annotations) => {
      const menuId = annotationInteraction.contextMenu.value?.annotationId
      if (menuId && !annotations.some((item) => item.id === menuId)) {
        annotationInteraction.closeContextMenu()
      }
      const draft = annotationInteraction.editorDraft.value
      if (draft?.mode === 'edit' && !annotations.some((item) => item.id === draft.annotation.id)) {
        annotationInteraction.closeEditor()
      }
    },
    { deep: true },
  )

  function measureTitle() {
    if (!titleAreaReserved.value || !titleMeasureElement.value) {
      measuredTitleWidth.value = 0
      measuredTitleHeight.value = 0
      return
    }
    const bounds = titleMeasureElement.value.getBoundingClientRect()
    measuredTitleWidth.value = titleMeasureElement.value.scrollWidth || bounds.width
    measuredTitleHeight.value = titleMeasureElement.value.scrollHeight || bounds.height
  }

  watch(
    [resolvedTitleText, titleAreaReserved, titleMeasureStyle],
    async () => {
      measuredTitleWidth.value = 0
      measuredTitleHeight.value = 0
      await nextTick()
      measureTitle()
    },
    { immediate: true },
  )

  onMounted(() => {
    window.addEventListener('keydown', handleInteractionKeyDown)
    window.addEventListener('keyup', handleInteractionKeyUp)
    if (!container.value) return
    resizeObserver.value = new ResizeObserver(([entry]) => {
      observedWidth.value = Math.max(0, entry?.contentRect.width ?? 0)
      observedHeight.value = Math.max(0, entry?.contentRect.height ?? 0)
      void nextTick(measureTitle)
    })
    resizeObserver.value.observe(container.value)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleInteractionKeyDown)
    window.removeEventListener('keyup', handleInteractionKeyUp)
    cancelPendingHover()
    resizeObserver.value?.disconnect()
    clearZoomBindings()
    editorSeriesOptions.value = []
  })

  return { goToPage, handleBeforeDataReferenceChange, handleDataReferenceChange }
}

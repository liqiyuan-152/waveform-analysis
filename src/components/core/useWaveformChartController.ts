import { useChartImageExport } from '../controls/useChartImageExport'
import { useControlMode } from '../controls/useControlMode'
import { useChartCommands } from '../controls/useChartCommands'
import { zoomIdentity, type ZoomTransform } from 'd3'
import {
  reactive,
  nextTick,
  onBeforeUnmount,
  markRaw,
  ref,
  shallowReactive,
  shallowRef,
  toRefs,
  watch,
  watchEffect,
  type ComponentPublicInstance,
  type Ref,
} from 'vue'

import { useWaveformInstanceId } from '../../utils/waveformId'
import { useWaveformAnnotationInteraction, type AnnotationSeriesCandidate } from '../annotation'
import { useWaveformChartAnnotations } from '../annotation/useWaveformChartAnnotations'
import { useWaveformHover } from '../interaction/useWaveformHover'
import { useWaveformViewport } from '../interaction/useWaveformViewport'
import { useWaveformZoom } from '../interaction/useWaveformZoom'
import { useAnimationFrameThrottle } from '../utils/useAnimationFrameThrottle'
import { margin } from './constants'
import { getPageSize } from './grid'
import type { WaveformHoverState } from './types'
import { useWaveformChartLifecycle } from './useWaveformChartLifecycle'
import { usePreparedWaveformSeries } from './useWaveformData'
import { useWaveformLayout } from './useWaveformLayout'
import { useWaveformPresentation } from './useWaveformPresentation'
import { useWaveformRenderSampling } from './useWaveformRenderSampling'
import type {
  ResolvedWaveformChartProps,
  ViewportSelectionState,
  WaveformChartEmit,
} from './waveformChartTypes'

function assignElement<T extends Element>(
  target: Ref<T | undefined>,
  element: Element | ComponentPublicInstance | null,
) {
  target.value = element instanceof Element ? (element as T) : undefined
}

export function useWaveformChartController(
  inputProps: ResolvedWaveformChartProps,
  emit: WaveformChartEmit,
) {
  const mode = useControlMode(inputProps, emit)
  const props = reactive({
    ...toRefs(inputProps),
    interactionMode: mode.mode,
  }) as ResolvedWaveformChartProps
  const boundaries = shallowRef<Record<string, [number, number]>>({})
  const container = ref<HTMLDivElement>()
  const svgElement = ref<SVGSVGElement>()
  const titleMeasureElement = ref<HTMLSpanElement>()
  const sharedOverlayElement = ref<SVGRectElement>()
  const observedWidth = ref(0)
  const observedHeight = ref(0)
  const measuredTitleWidth = ref(0)
  const measuredTitleHeight = ref(0)
  const paginationBandHeight = ref(0)
  const sharedTransform = shallowRef<ZoomTransform>(zoomIdentity)
  const independentTransforms = shallowRef<ZoomTransform[]>([])
  const sharedYDomains = ref<Record<string, [number, number]>>({})
  const independentYDomains = ref<Record<number, [number, number]>>({})
  const hoverState = shallowReactive<WaveformHoverState>({
    points: [],
    trackIndex: null,
    queryX: null,
    crosshairXByTrack: {},
    position: { x: 0, y: 0 },
  })
  const suppressHoverUntilMove = ref(false)
  const currentPage = ref(1)
  const resizeObserver = shallowRef<ResizeObserver>()
  const clipPathId = useWaveformInstanceId('waveform-clip')
  const internalHiddenSeriesIds = ref(new Set(props.defaultHiddenSeriesIds))
  const annotationInteraction = useWaveformAnnotationInteraction()
  const linePointOverrides = shallowRef<Record<string, import('../../types').WaveformPoint[]>>({})
  const editorSeriesOptions = ref<AnnotationSeriesCandidate[]>([])
  const hoverThrottle = useAnimationFrameThrottle()

  watch(
    [() => props.yDomain, () => props.yDomains],
    () => {
      sharedYDomains.value = {}
      independentYDomains.value = {}
    },
    { deep: true },
  )
  const selection = shallowRef<ViewportSelectionState | null>(null)
  const spacePressed = ref(false)
  const pointerInsideChart = ref(false)
  let handleBeforeDataReferenceChange: () => void = () => undefined
  let handleDataReferenceChange: () => void = () => undefined
  let prepareForDataChange: () => void = () => undefined
  const preparedSeries = usePreparedWaveformSeries(
    () => props.data,
    () => {
      prepareForDataChange()
      handleBeforeDataReferenceChange()
    },
    () => handleDataReferenceChange(),
  )

  const presentation = useWaveformPresentation({
    props,
    observedWidth,
    observedHeight,
    measuredTitleWidth,
    measuredTitleHeight,
    internalHiddenSeriesIds,
    paginationBandHeight,
  })
  const {
    chartWidth,
    chartHeight,
    isCleanView,
    isPresentationMode,
    hiddenSeriesIdSet,
    resolvedTitleText,
    titleAreaReserved,
    titleMeasureStyle,
    titleAreaHeight,
    chartTopMargin,
    innerHeight,
  } = presentation

  const layout = useWaveformLayout({
    props,
    preparedSeries,
    currentPage,
    hiddenSeriesIdSet,
    chartWidth,
    innerHeight,
    isCleanView,
    sharedTransform,
    independentTransforms,
    sharedYDomains,
    independentYDomains,
    annotationInteraction: markRaw(annotationInteraction),
    linePointOverrides,
    boundaries,
  })
  const {
    chartSeries,
    chartTracks,
    renderingOptions,
    trackLayouts,
    gridOptions,
    pageCount,
    pagedTracks,
    resolvedChartLeftMargin,
    innerWidth,
    hasChartArea,
    activeInteractionMode,
    isZoomMode,
    initialXDomain,
    sharedZoomDomain,
    resolveInitialTrackDomain,
    annotationLayoutsForTrack,
    resolveSeriesYScale,
  } = layout

  const sampling = useWaveformRenderSampling({
    props,
    emit,
    instanceId: clipPathId,
    preparedSeries,
    sourceTrackLayouts: trackLayouts,
    renderingOptions,
    linePointOverrides,
  })

  watchEffect(() => {
    paginationBandHeight.value =
      gridOptions.value.showPagination && pageCount.value > 1 && chartWidth.value <= 520 ? 40 : 0
  })

  const zoom = useWaveformZoom({
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
    isPresentationMode,
    resolveInitialTrackDomain,
    cancelPendingHover: () => hover.cancelPendingHover(),
  })
  prepareForDataChange = zoom.prepareForDataChange

  const annotations = useWaveformChartAnnotations({
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
  })

  const viewport = useWaveformViewport({
    clearBoundaries: (index) => commands.clearBoundaries(index),
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
    canZoomTrack: zoom.canZoomTrack,
    canZoomSharedTracks: zoom.canZoomSharedTracks,
    configureZoom: zoom.configureZoom,
    cancelPendingZoom: zoom.cancelPendingZoom,
    clearHover: () => hover.clearHover(),
    resolveTrackAtPointer: annotations.resolveTrackAtPointer,
  })

  const hover = useWaveformHover({
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
    updateViewportDrag: viewport.updateViewportDrag,
    resolveTrackAtPointer: annotations.resolveTrackAtPointer,
  })

  const cancelControls = () => {
    viewport.cancelViewportDrag()
    zoom.cancelPendingZoom()
    hover.clearHover()
    annotations.cancelAnnotation()
  }
  const commands = useChartCommands({
    props,
    emit,
    layout,
    mode,
    boundaries,
    independentTransforms,
    sharedTransform,
    independentYDomains,
    sharedYDomains,
    cancel: cancelControls,
    configure: zoom.configureZoom,
    legacyReset: viewport.resetViewport,
    legacySet: viewport.setViewportDomain,
  })
  watch(
    [mode.mode, () => props.zoomable, () => props.pannable, () => props.annotationsVisible],
    cancelControls,
    { flush: 'sync' },
  )
  watch([currentPage, () => props.displayMode], () => {
    boundaries.value = {}
    cancelControls()
  })
  watch(
    [
      () => props.initialXDomain,
      () => props.initialXDomains,
      hiddenSeriesIdSet,
      () => props.xDomainStrategy,
    ],
    commands.restoreInitialBoundaries,
    { deep: true },
  )
  onBeforeUnmount(cancelControls)

  const lifecycle = useWaveformChartLifecycle({
    preserveFullViewport: () => Object.keys(boundaries.value).length > 0,
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
    clearHover: hover.clearHover,
    cancelAnnotation: annotations.cancelAnnotation,
    configureZoom: zoom.configureZoom,
    resetViewport: viewport.resetViewport,
    cancelViewportDrag: viewport.cancelViewportDrag,
    cancelPendingHover: hover.cancelPendingHover,
    clearZoomBindings: zoom.clearZoomBindings,
  })
  handleBeforeDataReferenceChange = lifecycle.handleBeforeDataReferenceChange
  handleDataReferenceChange = () => {
    boundaries.value = {}
    viewport.cancelViewportDrag()
    lifecycle.handleDataReferenceChange()
    void nextTick(zoom.configureZoom)
  }

  const imageExport = useChartImageExport({
    container: () => container.value,
    svg: () => svgElement.value,
    size: () => ({
      width: chartWidth.value,
      height: chartHeight.value,
      titleHeight: titleAreaHeight.value,
    }),
    version: () => [
      props.data,
      JSON.stringify({
        annotations: props.annotations,
        annotationsVisible: props.annotationsVisible,
        title: props.title,
        axes: props.axes,
        frameStyle: props.frameStyle,
        frameNumber: props.frameNumber,
        frameNumbers: props.frameNumbers,
        legend: props.legend,
        cleanView: props.cleanView,
        rendering: props.rendering,
        hidden: [...hiddenSeriesIdSet.value],
        width: chartWidth.value,
        height: chartHeight.value,
        titleHeight: titleAreaHeight.value,
        page: currentPage.value,
        display: props.displayMode,
        overlay: props.overlayMode,
        shared: sharedTransform.value,
        independent: independentTransforms.value,
        sharedY: sharedYDomains.value,
        independentY: independentYDomains.value,
        boundaries: boundaries.value,
        initial: props.initialXDomain,
        initials: props.initialXDomains,
        y: props.yDomain,
        ys: props.yDomains,
        grid: props.grid,
        margin: props.plotMargin,
        xLabel: props.xLabel,
        yLabel: props.yLabel,
        timeUnit: props.timeUnit,
        zeroLine: props.zeroLine,
      }),
    ],
    ready: sampling.ready,
  })

  return reactive({
    ...toRefs(props),
    ...presentation,
    ...layout,
    ...annotations,
    ...viewport,
    ...hover,
    ...commands,
    ...imageExport,
    margin,
    getPageSize,
    currentPage,
    selection,
    pointerInsideChart,
    hoverState,
    annotationInteraction,
    editorDraft: annotationInteraction.editorDraft,
    contextMenu: annotationInteraction.contextMenu,
    editorSeriesOptions,
    clipPathId,
    goToPage: lifecycle.goToPage,
    setContainer: (element: Element | ComponentPublicInstance | null) =>
      assignElement(container, element),
    setSvgElement: (element: Element | ComponentPublicInstance | null) =>
      assignElement(svgElement, element),
    setTitleMeasureElement: (element: Element | ComponentPublicInstance | null) =>
      assignElement(titleMeasureElement, element),
    setSharedOverlayElement: (element: Element | ComponentPublicInstance | null) =>
      assignElement(sharedOverlayElement, element),
  })
}

export type WaveformChartController = ReturnType<typeof useWaveformChartController>

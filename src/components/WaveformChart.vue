<script setup lang="ts">
import { Pagination } from 'ant-design-vue'
import {
  bisector,
  pointer,
  scaleLinear,
  select,
  zoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomBehavior,
  type ZoomTransform,
} from 'd3'
import { resolveWaveformRenderingOptions } from '../core'
import { formatScientificYAxisLabel, paddedDomain } from '../utils'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'

import {
  type WaveformAnnotation,
  type WaveformData,
  type WaveformDisplayMode,
  type WaveformInteractionMode,
  type WaveformPoint,
  type WaveformRenderingOptions,
} from './data/types'
import {
  ANNOTATION_AMBIGUITY_DISTANCE,
  ANNOTATION_HIT_RADIUS,
  findAnnotationSeriesCandidates,
  interpolateAnnotationPoint,
  layoutAnnotations,
  useWaveformAnnotationInteraction,
  type AnnotationEditorAnchor,
  WaveformAnnotationContextMenu,
  WaveformAnnotationLayer,
  WaveformAnnotationToolbar,
  type AnnotationHit,
  type AnnotationSeriesCandidate,
  type AnnotationSeriesInfo,
  type AnnotationTrackLayout,
} from './annotation'
import { WaveformTooltip } from './interaction'
import { WaveformTrack } from './rendering'
import {
  channelColors,
  margin as chartMargin,
  minimumHeight as chartMinimumHeight,
} from './core/constants'
import {
  getGridGap,
  getPageCount,
  getPageSize,
  normalizeGridOptions,
  paginateSeries,
  resolveGridCellGeometry,
  X_AXIS_BAND,
  type WaveformGridOptions,
} from './core/grid'
import type { DisplaySeries, HoveredSeriesPoint, TrackLayout } from './core/types'
import { buildTrackLayouts } from './core/layout'
import { usePreparedWaveformSeries } from './core/useWaveformData'
import WaveformAnnotationEditor from './annotation/WaveformAnnotationEditor.vue'

const props = withDefaults(
  defineProps<{
    data: WaveformData
    displayMode?: WaveformDisplayMode
    height?: number
    xLabel?: string
    yLabel?: string
    lineColor?: string
    showTooltip?: boolean
    zoomable?: boolean
    timeUnit?: 's' | 'ms'
    frameNumber?: string | number
    annotations?: WaveformAnnotation[]
    annotationsVisible?: boolean
    interactionMode?: WaveformInteractionMode
    showAnnotationToolbar?: boolean
    grid?: WaveformGridOptions
    rendering?: WaveformRenderingOptions
  }>(),
  {
    displayMode: 'independent',
    height: 360,
    yLabel: '幅值',
    lineColor: '#0960bd',
    showTooltip: true,
    zoomable: true,
    timeUnit: 'ms',
    frameNumber: undefined,
    annotations: () => [],
    annotationsVisible: true,
    interactionMode: undefined,
    showAnnotationToolbar: false,
    grid: () => ({ rowCount: 2, columnCount: 1, showPagination: true }),
    rendering: () => ({}),
  },
)

const emit = defineEmits<{
  'point-hover': [point: WaveformPoint | null]
  'zoom-change': [domain: [number, number]]
  'update:annotations': [annotations: WaveformAnnotation[]]
  'update:annotations-visible': [visible: boolean]
  'update:interaction-mode': [mode: WaveformInteractionMode]
  'annotation-create': [annotation: WaveformAnnotation]
  'annotation-update': [annotation: WaveformAnnotation, previous: WaveformAnnotation]
  'annotation-delete': [annotation: WaveformAnnotation]
  'page-change': [page: number, pageCount: number]
}>()

const margin = chartMargin
const minimumHeight = chartMinimumHeight
const container = ref<HTMLDivElement>()
const svgElement = ref<SVGSVGElement>()
const sharedOverlayElement = ref<SVGRectElement>()
const width = ref(0)
const sharedTransform = shallowRef<ZoomTransform>(zoomIdentity)
const independentTransforms = shallowRef<ZoomTransform[]>([])
const hoveredSeriesPoints = ref<HoveredSeriesPoint[]>([])
const hoveredTrackIndex = ref<number | null>(null)
const hoverPosition = ref({ x: 0, y: 0 })
const currentPage = ref(1)
const resizeObserver = shallowRef<ResizeObserver>()
const zoomBehaviors = new Map<number | 'shared', ZoomBehavior<SVGRectElement, unknown>>()
const clipPathId = `${useId()}-waveform-clip`
const internalInteractionMode = ref<WaveformInteractionMode | undefined>(undefined)
const annotationInteraction = useWaveformAnnotationInteraction()
const editorSeriesOptions = ref<AnnotationSeriesCandidate[]>([])
let generatedAnnotationId = 0
let synchronizingZoomTransform = false
const preparedSeries = usePreparedWaveformSeries(() => props.data, handleDataReferenceChange)

// 用于传递给 WaveformTooltip 的接口
interface TooltipSeriesPoint {
  trackIndex: number
  name: string
  color: string
  unit?: string
  point: WaveformPoint
}

const chartHeight = computed(() =>
  Number.isFinite(props.height) ? Math.max(minimumHeight, props.height) : 360,
)
const innerHeight = computed(() => Math.max(0, chartHeight.value - margin.top - margin.bottom))
const chartSeries = computed<DisplaySeries[]>(() =>
  preparedSeries.value.map((series, index: number): DisplaySeries => ({
    ...series,
    color:
      series.color ?? (index === 0 ? props.lineColor : channelColors[index % channelColors.length]),
  })),
)
const gridOptions = computed(() => normalizeGridOptions(props.grid))
const renderingOptions = computed(() => resolveWaveformRenderingOptions(props.rendering))
const pageCount = computed(() => getPageCount(chartSeries.value.length, gridOptions.value))
const pagedSeries = computed(() =>
  paginateSeries(chartSeries.value, currentPage.value, gridOptions.value),
)

const yAxisCharacterWidth = 7
const yAxisTickPadding = 7
const yAxisOuterPadding = 4
const yAxisLabelGap = 6
const yAxisLabelBandWidth = 24
const minimumPlotWidth = 120

const yAxisMetrics = computed(() => {
  const formattedTickLabels = chartSeries.value.flatMap((series) => {
    const scale = scaleLinear(series.yDomain, [1, 0]).nice()
    const [axisMin, axisMax] = scale.domain()
    const values = scale.ticks(10)
    const topTickValue = values.reduce<number | undefined>((closestTick, tickValue) => {
      if (closestTick === undefined) return tickValue
      return Math.abs(tickValue - axisMax) < Math.abs(closestTick - axisMax)
        ? tickValue
        : closestTick
    }, undefined)
    return values.map((value) =>
      formatScientificYAxisLabel(value, { axisMin, axisMax, topTickValue }),
    )
  })
  const maximumCharacterCount = Math.max(1, ...formattedTickLabels.map((label) => label.length))
  const tickTextWidth = maximumCharacterCount * yAxisCharacterWidth
  const tickClearance = tickTextWidth + yAxisTickPadding + yAxisOuterPadding
  const labelCenterX = -(yAxisTickPadding + tickTextWidth + yAxisLabelGap + yAxisLabelBandWidth / 2)
  const fullClearance =
    tickTextWidth + yAxisTickPadding + yAxisLabelGap + yAxisLabelBandWidth + yAxisOuterPadding

  return { tickClearance, fullClearance, labelCenterX }
})
const hasYAxisLabels = computed(() =>
  chartSeries.value.some((series) => Boolean(series.name.trim() || props.yLabel)),
)
const chartLeftMargin = computed(() =>
  Math.max(
    margin.left,
    hasYAxisLabels.value
      ? yAxisMetrics.value.fullClearance
      : chartSeries.value.length
        ? yAxisMetrics.value.tickClearance
        : 0,
  ),
)
const innerWidth = computed(() => Math.max(0, width.value - chartLeftMargin.value - margin.right))
const yAxisLayout = computed(() => {
  const baseGap = getGridGap(props.displayMode)
  const columnCount = gridOptions.value.columnCount
  const hasMultipleColumns = columnCount > 1
  const fullGap = Math.max(baseGap, yAxisMetrics.value.fullClearance)
  const tickGap = Math.max(baseGap, yAxisMetrics.value.tickClearance)
  const fullGapPlotWidth = (innerWidth.value - fullGap * Math.max(0, columnCount - 1)) / columnCount
  const canReserveLabelClearance = fullGapPlotWidth >= minimumPlotWidth

  return {
    horizontalGap:
      hasMultipleColumns && chartSeries.value.length
        ? hasYAxisLabels.value && canReserveLabelClearance
          ? fullGap
          : tickGap
        : baseGap,
    hideSecondaryLabels: hasMultipleColumns && hasYAxisLabels.value && !canReserveLabelClearance,
  }
})
const hasWaveformData = computed(() => chartSeries.value.length > 0)
const hoveredPoint = computed(() => hoveredSeriesPoints.value[0]?.point ?? null)
const hasChartArea = computed(() => innerWidth.value > 0 && innerHeight.value > 0)
const resolvedXLabel = computed(() => props.xLabel ?? `时间（${props.timeUnit}）`)
const activeInteractionMode = computed(() => props.interactionMode ?? internalInteractionMode.value)
// 当 interactionMode 未定义或为 'zoom' 时启用缩放
const isZoomMode = computed(
  () => activeInteractionMode.value === 'zoom' || activeInteractionMode.value === undefined,
)

// 转换为 Tooltip 组件需要的格式
const tooltipSeriesPoints = computed<TooltipSeriesPoint[]>(() => {
  return hoveredSeriesPoints.value.map((item) => ({
    trackIndex: item.trackIndex,
    name: item.name,
    color: item.color,
    unit: item.unit,
    point: item.point,
  }))
})

const sharedXDomain = computed(() =>
  paddedDomain(chartSeries.value.flatMap((series) => series.xDomain)),
)
const sharedZoomDomain = computed(
  () =>
    sharedTransform.value
      .rescaleX(scaleLinear(sharedXDomain.value, [0, innerWidth.value]))
      .domain() as [number, number],
)

const gridCells = computed(() => {
  const cells = resolveGridCellGeometry(
    innerWidth.value,
    innerHeight.value,
    gridOptions.value,
    props.displayMode,
    pagedSeries.value.map(Boolean),
    yAxisLayout.value.horizontalGap,
  )
  return cells.map((cell, index) => ({ ...cell, series: pagedSeries.value[index] }))
})

const trackLayouts = computed<TrackLayout[]>(() =>
  buildTrackLayouts({
    cells: gridCells.value,
    grid: gridOptions.value,
    displayMode: props.displayMode,
    independentTransforms: independentTransforms.value,
    sharedZoomDomain: sharedZoomDomain.value,
    timeUnit: props.timeUnit,
    rendering: renderingOptions.value,
    hideSecondaryLabels: yAxisLayout.value.hideSecondaryLabels,
    yAxisLabelX: yAxisMetrics.value.labelCenterX,
  }),
)

const renderedAnnotations = computed(() =>
  props.annotationsVisible
    ? layoutAnnotations(
        props.annotations,
        trackLayouts.value as AnnotationTrackLayout[],
        innerWidth.value,
        innerHeight.value,
      )
    : [],
)
const xAxisTitleY = computed(() => innerHeight.value + X_AXIS_BAND + 10)

const editorSeries = computed<AnnotationSeriesInfo | undefined>(() => {
  const seriesId = annotationInteraction.editorDraft.value?.annotation.seriesId
  const series = chartSeries.value.find((item) => item.id === seriesId)
  return series
    ? {
        id: series.id,
        name: series.name.trim() || series.id,
        color: series.color,
        unit: series.unit,
      }
    : undefined
})

function resolveFrameNumber(trackIndex: number): string | number | undefined {
  if (props.frameNumber === undefined || props.frameNumber === null) return undefined
  if (chartSeries.value.length === 1) return props.frameNumber
  return typeof props.frameNumber === 'number'
    ? props.frameNumber + trackIndex
    : `${props.frameNumber}-${trackIndex + 1}`
}

function handleSharedZoom(event: D3ZoomEvent<SVGRectElement, unknown>) {
  if (synchronizingZoomTransform) return
  const transform = event.transform
  sharedTransform.value = transform
  const domain = transform
    .rescaleX(scaleLinear(sharedXDomain.value, [0, innerWidth.value]))
    .domain()
  emit('zoom-change', [domain[0], domain[1]])
}

function handleIndependentZoom(event: D3ZoomEvent<SVGRectElement, unknown>, trackIndex: number) {
  if (synchronizingZoomTransform) return
  const transform = event.transform
  const nextTransforms = [...independentTransforms.value]
  nextTransforms[trackIndex] = transform
  independentTransforms.value = nextTransforms
  const track = trackLayouts.value[trackIndex]
  if (!track) return
  const domain = track.xScale.domain()
  emit('zoom-change', [domain[0], domain[1]])
}

function clearZoomBindings() {
  const svg = svgElement.value
  if (svg) {
    const overlays = svg.querySelectorAll<SVGRectElement>('.waveform-chart__overlay')
    overlays.forEach((overlay) => {
      if (overlay) select(overlay).on('.zoom', null)
    })
  }
  zoomBehaviors.clear()
}

function configureZoom() {
  clearZoomBindings()
  if (!props.zoomable || !isZoomMode.value || !hasChartArea.value || !trackLayouts.value.length)
    return

  if (props.displayMode === 'independent') {
    trackLayouts.value.forEach((track) => {
      const overlay = svgElement.value?.querySelector<SVGRectElement>(
        `[data-independent-overlay-index="${track.index}"]`,
      )
      if (!overlay) return
      const behavior = zoom<SVGRectElement, unknown>()
        .scaleExtent([1, 40])
        .extent([
          [0, 0],
          [track.width, track.height],
        ])
        .translateExtent([
          [0, 0],
          [track.width, track.height],
        ])
        .on('zoom', (event) => handleIndependentZoom(event, track.index))
      zoomBehaviors.set(track.index, behavior)
      synchronizingZoomTransform = true
      try {
        select(overlay)
          .call(behavior)
          .call(behavior.transform, independentTransforms.value[track.index] ?? zoomIdentity)
      } finally {
        synchronizingZoomTransform = false
      }
    })
    return
  }

  if (!sharedOverlayElement.value) return
  const behavior = zoom<SVGRectElement, unknown>()
    .scaleExtent([1, 40])
    .extent([
      [0, 0],
      [innerWidth.value, innerHeight.value],
    ])
    .translateExtent([
      [0, 0],
      [innerWidth.value, innerHeight.value],
    ])
    .on('zoom', handleSharedZoom)
  zoomBehaviors.set('shared', behavior)
  const overlay = sharedOverlayElement.value
  if (overlay) {
    synchronizingZoomTransform = true
    try {
      select(overlay).call(behavior).call(behavior.transform, sharedTransform.value)
    } finally {
      synchronizingZoomTransform = false
    }
  }
}

function clearHover() {
  hoveredSeriesPoints.value = []
  hoveredTrackIndex.value = null
  emit('point-hover', null)
}

function nearestPoint(series: DisplaySeries, xValue: number): WaveformPoint | undefined {
  const index = bisector((point: WaveformPoint) => point.x).center(series.points, xValue)
  return series.points[index]
}

function makeAnnotationId(): string {
  generatedAnnotationId += 1
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `annotation-${Date.now()}-${generatedAnnotationId}`
}

function setInteractionMode(mode: WaveformInteractionMode) {
  if (props.interactionMode === undefined) internalInteractionMode.value = mode
  annotationInteraction.closeContextMenu()
  editorSeriesOptions.value = []
  emit('update:interaction-mode', mode)
}

function setAnnotationsVisible(visible: boolean) {
  annotationInteraction.closeContextMenu()
  if (!visible) {
    annotationInteraction.closeEditor()
    editorSeriesOptions.value = []
  }
  emit('update:annotations-visible', visible)
}

function resolvePointerEditorAnchor(
  event: MouseEvent,
  trackIndex?: number,
): AnnotationEditorAnchor {
  const overlay = event.currentTarget as SVGRectElement | null
  if (!overlay) return { x: width.value / 2, y: chartHeight.value / 2 }
  const [pointerX, pointerY] = pointer(event, overlay)
  const track = trackIndex === undefined ? undefined : trackLayouts.value[trackIndex]
  return {
    x: chartLeftMargin.value + (track ? track.left + pointerX : pointerX),
    y: margin.top + (track ? track.top + pointerY : pointerY),
  }
}

function resolveAnnotationEditorAnchor(annotation: WaveformAnnotation): AnnotationEditorAnchor {
  const track = trackLayouts.value.find((item) => item.series.id === annotation.seriesId)
  return {
    x: track ? chartLeftMargin.value + track.left + track.xScale(annotation.x) : width.value / 2,
    y: track ? margin.top + track.top + track.yScale(annotation.y) : chartHeight.value / 2,
  }
}

function beginCreate(
  hit: AnnotationHit,
  anchor: AnnotationEditorAnchor,
  candidates: AnnotationSeriesCandidate[],
) {
  annotationInteraction.openCreate(hit, makeAnnotationId, anchor)
  editorSeriesOptions.value = candidates
  const draft = annotationInteraction.editorDraft.value
  const track = trackLayouts.value.find((item) => item.index === hit.trackIndex)
  if (draft?.mode === 'add') {
    draft.annotation.style = {
      borderColor: track?.series.color || '#1677ff',
      textColor: '#333333',
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
    }
  }
}

function changeDraftSeries(seriesId: string) {
  const draft = annotationInteraction.editorDraft.value
  const candidate = editorSeriesOptions.value.find((item) => item.seriesId === seriesId)
  const track = trackLayouts.value.find((item) => item.series.id === seriesId)
  const point =
    track && draft ? interpolateAnnotationPoint(track.series.points, draft.annotation.x) : null
  if (!draft || !candidate || !track || !point) return
  draft.annotation = {
    ...draft.annotation,
    seriesId,
    y: point.y,
    style: { ...draft.annotation.style, borderColor: candidate.color },
  }
}

function cancelAnnotation() {
  annotationInteraction.closeEditor()
  editorSeriesOptions.value = []
}

interface AnnotationCandidateContext {
  candidates: AnnotationSeriesCandidate[]
  editorAnchor: AnnotationEditorAnchor
}

function resolveTrackAtPointer(
  pointerX: number,
  pointerY: number,
  trackIndex?: number,
): TrackLayout | undefined {
  if (trackIndex !== undefined) return trackLayouts.value[trackIndex]
  if (!trackLayouts.value.length) return undefined

  const distanceToTrack = (track: TrackLayout) => {
    const xDistance =
      pointerX < track.left
        ? track.left - pointerX
        : pointerX > track.left + track.width
          ? pointerX - track.left - track.width
          : 0
    if (pointerY < track.top) return track.top - pointerY
    if (pointerY > track.top + track.height) return pointerY - (track.top + track.height)
    return xDistance
  }
  return trackLayouts.value.reduce((closest, candidate) => {
    const distance = distanceToTrack(candidate)
    const closestDistance = distanceToTrack(closest)
    if (distance !== closestDistance) return distance < closestDistance ? candidate : closest
    const centerDistance = Math.abs(pointerY - (candidate.top + candidate.height / 2))
    const closestCenterDistance = Math.abs(pointerY - (closest.top + closest.height / 2))
    return centerDistance < closestCenterDistance ? candidate : closest
  })
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
  const localPointerX = Math.max(0, Math.min(referenceTrack.width, clampedX - referenceTrack.left))
  const xValue = referenceTrack.xScale.invert(localPointerX)
  return {
    candidates: findAnnotationSeriesCandidates(
      [referenceTrack] as AnnotationTrackLayout[],
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
  if (!props.annotationsVisible || activeInteractionMode.value !== 'annotation') return
  const context = resolveAnnotationCandidates(event, trackIndex)
  if (!context) return
  const nearby = nearbyCandidates(context.candidates)
  if (!nearby.length) return
  event.preventDefault()
  event.stopPropagation()
  beginCreate(nearby[0], context.editorAnchor, context.candidates)
}

function handleAnnotationContextMenu(event: MouseEvent, trackIndex?: number) {
  if (!props.annotationsVisible) return
  event.preventDefault()
  event.stopPropagation()
  const context = resolveAnnotationCandidates(event, trackIndex)
  if (!context || !context.candidates.length) {
    return
  }
  const nearby = nearbyCandidates(context.candidates)
  const initial = nearby[0] ?? context.candidates[0]
  beginCreate(initial, context.editorAnchor, context.candidates)
}

function handleExistingAnnotationContextMenu(annotationId: string, event: MouseEvent) {
  if (!props.annotationsVisible || !container.value) return
  editorSeriesOptions.value = []
  const annotation = props.annotations.find((item) => item.id === annotationId)
  if (!annotation) return
  const bounds = container.value.getBoundingClientRect()
  const editorAnchor = {
    x: Math.max(0, Math.min(event.clientX - bounds.left, width.value)),
    y: Math.max(0, Math.min(event.clientY - bounds.top, chartHeight.value)),
  }
  annotationInteraction.openContextMenu({
    annotationId,
    x: Math.max(4, Math.min(event.clientX - bounds.left, width.value - 120)),
    y: Math.max(4, Math.min(event.clientY - bounds.top, chartHeight.value - 110)),
    editorAnchor,
  })
}

function editContextAnnotation() {
  const context = annotationInteraction.contextMenu.value
  const annotationId = context?.annotationId
  const annotation = props.annotations.find((item) => item.id === annotationId)
  if (annotation) {
    const track = trackLayouts.value.find((item) => item.series.id === annotation.seriesId)
    editorSeriesOptions.value = track
      ? findAnnotationSeriesCandidates(
          [track] as AnnotationTrackLayout[],
          annotation.x,
          track.xScale(annotation.x),
          track.top + track.yScale(annotation.y),
        )
      : []
    annotationInteraction.openEdit(
      annotation,
      context?.editorAnchor ?? resolveAnnotationEditorAnchor(annotation),
    )
  }
}

function deleteContextAnnotation() {
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
  const draft = annotationInteraction.editorDraft.value
  if (!draft) return
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

function handleIndependentPointerMove(event: PointerEvent, trackIndex: number) {
  const overlay = event.currentTarget as SVGRectElement | null
  const track = trackLayouts.value[trackIndex]
  if (!overlay || !track) return
  const [pointerX, pointerY] = pointer(event, overlay)
  const xValue = track.xScale.invert(Math.max(0, Math.min(innerWidth.value, pointerX)))
  const point = nearestPoint(track.series, xValue)
  hoveredSeriesPoints.value = point ? [{ ...track.series, trackIndex, point }] : []
  hoveredTrackIndex.value = trackIndex
  hoverPosition.value = {
    x: chartLeftMargin.value + track.left + pointerX,
    y: margin.top + track.top + pointerY,
  }
  emit('point-hover', point ?? null)
}

function handleSharedPointerMove(event: PointerEvent) {
  if (!sharedOverlayElement.value || !trackLayouts.value.length) return
  const [pointerX, pointerY] = pointer(event, sharedOverlayElement.value)
  const referenceTrack = resolveTrackAtPointer(pointerX, pointerY) ?? trackLayouts.value[0]
  if (!referenceTrack) return
  const localPointerX = Math.max(0, Math.min(referenceTrack.width, pointerX - referenceTrack.left))
  const xValue = referenceTrack.xScale.invert(localPointerX)
  hoveredSeriesPoints.value = trackLayouts.value.flatMap((track) => {
    const point = nearestPoint(track.series, xValue)
    return point ? [{ ...track.series, trackIndex: track.index, point }] : []
  })
  hoveredTrackIndex.value = null
  hoverPosition.value = {
    x: chartLeftMargin.value + pointerX,
    y: margin.top + pointerY,
  }
  emit('point-hover', hoveredPoint.value)
}

function resetViewport() {
  sharedTransform.value = zoomIdentity
  independentTransforms.value = chartSeries.value.map(() => zoomIdentity)
  clearHover()
  editorSeriesOptions.value = []
  void nextTick(configureZoom)
}

function goToPage(page: number) {
  const nextPage = Math.min(pageCount.value, Math.max(1, Math.floor(page)))
  if (nextPage === currentPage.value) return
  currentPage.value = nextPage
  clearHover()
  annotationInteraction.closeContextMenu()
  cancelAnnotation()
  if (props.displayMode === 'independent') {
    independentTransforms.value = pagedSeries.value.map(() => zoomIdentity)
  }
  void nextTick(configureZoom)
  emit('page-change', nextPage, pageCount.value)
}

watch(
  [
    innerWidth,
    innerHeight,
    () => props.zoomable,
    () => props.displayMode,
    () => chartSeries.value.length,
    () => currentPage.value,
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

function handleDataReferenceChange() {
  const previousPage = currentPage.value
  currentPage.value = 1
  resetViewport()
  if (previousPage !== 1) emit('page-change', 1, pageCount.value)
}

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
  if (currentPage.value > pageCount.value) {
    currentPage.value = pageCount.value
  } else if (currentPage.value !== 1) {
    currentPage.value = 1
  }
  if (previousPage !== currentPage.value) {
    emit('page-change', currentPage.value, pageCount.value)
  }
  clearHover()
  void nextTick(configureZoom)
})

watch(activeInteractionMode, () => {
  editorSeriesOptions.value = []
})

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

onMounted(() => {
  if (!container.value) return
  resizeObserver.value = new ResizeObserver(([entry]) => {
    width.value = Math.max(0, entry?.contentRect.width ?? 0)
  })
  resizeObserver.value.observe(container.value)
})

onBeforeUnmount(() => {
  resizeObserver.value?.disconnect()
  clearZoomBindings()
  editorSeriesOptions.value = []
})
</script>

<template>
  <div
    ref="container"
    class="waveform-chart"
    :class="[
      `waveform-chart--${displayMode}`,
      `waveform-chart--interaction-${activeInteractionMode}`,
    ]"
    :style="{ height: `${chartHeight}px` }"
    :data-display-mode="displayMode"
    :data-interaction-mode="activeInteractionMode"
    :data-chart-left-margin="chartLeftMargin"
  >
    <svg
      ref="svgElement"
      class="waveform-chart__svg"
      :width="width"
      :height="chartHeight"
      role="img"
      :aria-label="hasWaveformData ? '波形折线图' : '暂无波形数据'"
    >
      <defs>
        <clipPath
          v-for="track in trackLayouts"
          :id="`${clipPathId}-${track.index}`"
          :key="`${clipPathId}-${track.index}`"
          clipPathUnits="userSpaceOnUse"
        >
          <rect :width="track.width" :height="track.height" />
        </clipPath>
      </defs>

      <g :transform="`translate(${chartLeftMargin}, ${margin.top})`">
        <g class="waveform-chart__grid-slots" aria-hidden="true">
          <g
            v-for="cell in gridCells"
            :key="`grid-slot-${cell.slotIndex}`"
            :transform="`translate(${cell.left}, ${cell.top})`"
          >
            <rect
              v-if="!cell.series"
              class="waveform-chart__grid-slot-placeholder"
              :width="cell.width"
              :height="cell.cellHeight"
            />
          </g>
        </g>
        <!-- 轨道渲染 -->
        <WaveformTrack
          v-for="track in trackLayouts"
          :key="`${track.index}-${track.series.name}`"
          :track="track"
          :clip-path-id="clipPathId"
          :inner-width="innerWidth"
          :show-tooltip="showTooltip"
          :zoomable="zoomable"
          :display-mode="displayMode"
          :interaction-mode="activeInteractionMode"
          :frame-number="resolveFrameNumber(track.index)"
          :time-unit="timeUnit"
          :y-label="yLabel"
          :hovered-point="hoveredSeriesPoints.find((p) => p.trackIndex === track.index)"
          @pointer-move="handleIndependentPointerMove($event, track.index)"
          @pointer-leave="clearHover"
          @click="handleAnnotationClick($event, track.index)"
          @contextmenu="handleAnnotationContextMenu($event, track.index)"
        />

        <rect
          v-if="displayMode !== 'independent' && trackLayouts.length"
          ref="sharedOverlayElement"
          class="waveform-chart__overlay waveform-chart__overlay--shared"
          :class="{
            'is-zoomable': zoomable && isZoomMode,
            'is-annotating': activeInteractionMode === 'annotation',
          }"
          :width="innerWidth"
          :height="innerHeight"
          @pointermove="handleSharedPointerMove"
          @pointerleave="clearHover"
          @click="handleAnnotationClick"
          @contextmenu="handleAnnotationContextMenu"
        />

        <WaveformAnnotationLayer
          :annotations="renderedAnnotations"
          :visible="annotationsVisible"
          @contextmenu="handleExistingAnnotationContextMenu"
        />

        <text
          v-if="resolvedXLabel"
          class="waveform-chart__label"
          :x="innerWidth / 2"
          :y="xAxisTitleY"
          text-anchor="middle"
        >
          {{ resolvedXLabel }}
        </text>
      </g>

      <text
        v-if="hasChartArea && !hasWaveformData"
        class="waveform-chart__empty"
        :x="width / 2"
        :y="chartHeight / 2"
        text-anchor="middle"
      >
        暂无有效波形数据
      </text>
    </svg>

    <Pagination
      v-if="gridOptions.showPagination && pageCount > 1"
      class="waveform-chart__pagination"
      aria-label="波形分页"
      :current="currentPage"
      :page-size="getPageSize(gridOptions)"
      :total="chartSeries.length"
      :show-size-changer="false"
      :show-quick-jumper="false"
      @change="goToPage"
    />

    <WaveformAnnotationToolbar
      v-if="showAnnotationToolbar"
      :interaction-mode="activeInteractionMode"
      :annotations-visible="annotationsVisible"
      @update:interaction-mode="setInteractionMode"
      @update:annotations-visible="setAnnotationsVisible"
    />

    <WaveformAnnotationEditor
      v-if="annotationInteraction.editorDraft.value"
      :annotation="annotationInteraction.editorDraft.value.annotation"
      :mode="annotationInteraction.editorDraft.value.mode"
      :series="editorSeries"
      :series-options="editorSeriesOptions"
      :time-unit="timeUnit"
      @confirm="confirmAnnotation"
      @cancel="cancelAnnotation"
      @series-change="changeDraftSeries"
    />

    <WaveformAnnotationContextMenu
      :visible="annotationInteraction.contextMenu.value !== null"
      :x="annotationInteraction.contextMenu.value?.x || 0"
      :y="annotationInteraction.contextMenu.value?.y || 0"
      :can-edit="Boolean(annotationInteraction.contextMenu.value?.annotationId)"
      @edit="editContextAnnotation"
      @delete="deleteContextAnnotation"
      @close="annotationInteraction.closeContextMenu"
    />

    <!-- Tooltip -->
    <WaveformTooltip
      :visible="showTooltip && hoveredPoint !== null"
      :position="hoverPosition"
      :time-unit="timeUnit"
      :hovered-point="hoveredPoint"
      :series-points="tooltipSeriesPoints"
      :container-width="width"
      :container-height="chartHeight"
    />
  </div>
</template>

<style scoped>
.waveform-chart {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: #475467;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 8%);
  border-radius: 6px;
}

.waveform-chart__pagination {
  position: absolute;
  right: 10px;
  bottom: 6px;
  z-index: 2;
}

.waveform-chart__pagination :deep(.ant-pagination-item),
.waveform-chart__pagination :deep(.ant-pagination-prev .ant-pagination-item-link),
.waveform-chart__pagination :deep(.ant-pagination-next .ant-pagination-item-link) {
  background: #fff;
  border-color: #d9d9d9;
}

.waveform-chart__pagination :deep(.ant-pagination-item-active) {
  border-color: #1677ff;
}

.waveform-chart__grid-slot-placeholder {
  fill: #fafbfc;
  stroke: #e4e7ec;
  stroke-dasharray: 4 4;
  pointer-events: none;
}

.waveform-chart__svg {
  display: block;
  max-width: 100%;
}

.waveform-chart__overlay {
  fill: transparent;
  cursor: crosshair;
  touch-action: none;
}

.waveform-chart__overlay.is-zoomable {
  cursor: grab;
}

.waveform-chart__overlay.is-zoomable:active {
  cursor: grabbing;
}

.waveform-chart__overlay.is-annotating {
  cursor: crosshair;
}

.waveform-chart__label,
.waveform-chart__empty {
  fill: #595959;
  font-size: 12px;
}
</style>

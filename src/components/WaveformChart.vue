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
import { formatScientificAxisExponent, formatScientificAxisLabel, paddedDomain } from '../utils'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  watch,
  type CSSProperties,
} from 'vue'

import {
  type WaveformAnnotation,
  type WaveformData,
  type WaveformDisplayMode,
  type WaveformFrameStyle,
  type WaveformInteractionMode,
  type WaveformOverlayMode,
  type WaveformLegendOptions,
  type WaveformLegendOrientation,
  type WaveformLegendPosition,
  type WaveformPoint,
  type WaveformRenderingOptions,
  type WaveformTitleOptions,
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
import type { DisplaySeries, DisplayTrack, HoveredSeriesPoint, TrackLayout } from './core/types'
import { buildTrackLayouts, measureTrackYAxisClearance } from './core/layout'
import { calculateRotatedTitleLayout, TITLE_AREA_HORIZONTAL_PADDING } from './core/title'
import { usePreparedWaveformSeries } from './core/useWaveformData'
import WaveformAnnotationEditor from './annotation/WaveformAnnotationEditor.vue'

const props = withDefaults(
  defineProps<{
    data: WaveformData
    displayMode?: WaveformDisplayMode
    overlayMode?: WaveformOverlayMode
    width?: number
    height?: number
    xLabel?: string
    yLabel?: string
    lineColor?: string
    showTooltip?: boolean
    zoomable?: boolean
    timeUnit?: 's' | 'ms'
    frameNumber?: string | number
    frameStyle?: WaveformFrameStyle
    annotations?: WaveformAnnotation[]
    annotationsVisible?: boolean
    interactionMode?: WaveformInteractionMode
    showAnnotationToolbar?: boolean
    grid?: WaveformGridOptions
    rendering?: WaveformRenderingOptions
    title?: WaveformTitleOptions
    legend?: WaveformLegendOptions
  }>(),
  {
    displayMode: 'independent',
    overlayMode: 'single-axis',
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
    legend: () => ({ position: 'top-right', orientation: 'auto' }),
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
const titleMeasureElement = ref<HTMLSpanElement>()
const sharedOverlayElement = ref<SVGRectElement>()
const observedWidth = ref(0)
const observedHeight = ref(0)
const measuredTitleWidth = ref(0)
const measuredTitleHeight = ref(0)
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

const fixedWidth = computed(() =>
  Number.isFinite(props.width) ? Math.max(0, props.width ?? 0) : undefined,
)
const fixedHeight = computed(() =>
  Number.isFinite(props.height) ? Math.max(minimumHeight, props.height ?? 0) : undefined,
)
const chartWidth = computed(() =>
  observedWidth.value > 0 ? observedWidth.value : (fixedWidth.value ?? 0),
)
const chartHeight = computed(() =>
  observedHeight.value > 0 ? observedHeight.value : (fixedHeight.value ?? minimumHeight),
)
const containerStyle = computed(() => ({
  width: fixedWidth.value === undefined ? '100%' : `${fixedWidth.value}px`,
  height: fixedHeight.value === undefined ? '100%' : `${fixedHeight.value}px`,
}))
const legendPosition = computed<WaveformLegendPosition>(() => props.legend?.position ?? 'top-right')
const legendBackgroundColor = computed(
  () => props.legend?.backgroundColor || 'rgba(255, 255, 255, 0.7)',
)
const legendOrientation = computed<Exclude<WaveformLegendOrientation, 'auto'>>(() => {
  const orientation = props.legend?.orientation ?? 'auto'
  if (orientation !== 'auto') return orientation
  return legendPosition.value === 'top' || legendPosition.value === 'bottom'
    ? 'horizontal'
    : 'vertical'
})
const resolvedTitleText = computed(() => props.title?.text.trim() ?? '')
const titleVisible = computed(
  () =>
    Boolean(props.title) && props.title?.visible !== false && resolvedTitleText.value.length > 0,
)
const titleFontSize = computed(() => {
  const fontSize = props.title?.textStyle?.fontSize
  return Number.isFinite(fontSize) && (fontSize ?? 0) > 0 ? (fontSize as number) : 14
})
const titleRotation = computed(() => {
  const rotation = props.title?.textStyle?.rotation
  return Number.isFinite(rotation) ? (rotation as number) : 0
})
const titleIsRotated = computed(() => {
  const normalizedRotation = ((titleRotation.value % 360) + 360) % 360
  return normalizedRotation > 1e-6 && Math.abs(normalizedRotation - 360) > 1e-6
})
const titlePresentationStyle = computed<CSSProperties>(() => ({
  color: props.title?.textStyle?.color ?? '#1f2937',
  fontSize: `${titleFontSize.value}px`,
  fontFamily: props.title?.textStyle?.fontFamily || '"Microsoft YaHei", "微软雅黑", sans-serif',
  fontWeight: props.title?.textStyle?.fontWeight ?? 400,
  fontStyle: props.title?.textStyle?.fontStyle ?? 'normal',
  textDecoration: props.title?.textStyle?.textDecoration ?? 'none',
  letterSpacing: props.title?.textStyle?.letterSpacing ?? 'normal',
  lineHeight: '1.2',
}))
const estimatedTitleWidth = computed(() => {
  const letterSpacing = Number.parseFloat(props.title?.textStyle?.letterSpacing ?? '')
  const spacingWidth = Number.isFinite(letterSpacing)
    ? Math.max(0, resolvedTitleText.value.length - 1) * letterSpacing
    : 0
  return Math.max(1, resolvedTitleText.value.length * titleFontSize.value * 0.62 + spacingWidth)
})
const titleAvailableWidth = computed(() => {
  const measuredAvailableWidth = chartWidth.value - TITLE_AREA_HORIZONTAL_PADDING * 2
  return measuredAvailableWidth > 0 ? measuredAvailableWidth : estimatedTitleWidth.value
})
const titleMeasureStyle = computed<CSSProperties>(() => ({
  ...titlePresentationStyle.value,
  width: 'max-content',
  maxWidth: titleIsRotated.value ? 'none' : `${titleAvailableWidth.value}px`,
  whiteSpace: titleIsRotated.value ? 'nowrap' : 'normal',
  overflowWrap: titleIsRotated.value ? 'normal' : 'anywhere',
}))
const titleLayout = computed(() =>
  calculateRotatedTitleLayout({
    naturalWidth: measuredTitleWidth.value || estimatedTitleWidth.value,
    naturalHeight: measuredTitleHeight.value || titleFontSize.value * 1.2,
    availableWidth: titleAvailableWidth.value,
    rotation: titleRotation.value,
  }),
)
const titleAreaHeight = computed(() => (titleVisible.value ? titleLayout.value.areaHeight : 0))
const drawingHeight = computed(() => Math.max(0, chartHeight.value - titleAreaHeight.value))
const innerHeight = computed(() => Math.max(0, drawingHeight.value - margin.top - margin.bottom))
const titleAreaStyle = computed<CSSProperties>(() => ({
  height: `${titleAreaHeight.value}px`,
  justifyContent:
    props.title?.align === 'left'
      ? 'flex-start'
      : props.title?.align === 'right'
        ? 'flex-end'
        : 'center',
}))
const titleVisualStyle = computed<CSSProperties>(() => ({
  width: `${titleLayout.value.visualWidth}px`,
  height: `${titleLayout.value.visualHeight}px`,
}))
const titleTextStyle = computed<CSSProperties>(() => ({
  ...titlePresentationStyle.value,
  width: `${titleLayout.value.textWidth}px`,
  minHeight: `${titleLayout.value.textHeight}px`,
  textAlign: props.title?.align ?? 'center',
  whiteSpace: titleIsRotated.value ? 'nowrap' : 'normal',
  overflowWrap: titleIsRotated.value ? 'normal' : 'anywhere',
  transform: `translate(-50%, -50%) rotate(${titleRotation.value}deg) scale(${titleLayout.value.scale})`,
}))
const chartSeries = computed<DisplaySeries[]>(() =>
  preparedSeries.value.map((series, index: number): DisplaySeries => ({
    ...series,
    color:
      series.color ?? (index === 0 ? props.lineColor : channelColors[index % channelColors.length]),
  })),
)
const chartTracks = computed<DisplayTrack[]>(() => {
  const groupedSeries = new Map<string, DisplaySeries[]>()
  chartSeries.value.forEach((series) => {
    const trackId = series.trackId || series.id
    const trackSeries = groupedSeries.get(trackId)
    if (trackSeries) trackSeries.push(series)
    else groupedSeries.set(trackId, [series])
  })
  return Array.from(groupedSeries, ([id, series]) => ({
    id,
    series,
    xDomain: paddedDomain(series.flatMap((item) => item.xDomain)),
    yDomain: paddedDomain(series.flatMap((item) => item.yDomain)),
  }))
})
const gridOptions = computed(() => normalizeGridOptions(props.grid))
const renderingOptions = computed(() => resolveWaveformRenderingOptions(props.rendering))
const pageCount = computed(() => getPageCount(chartTracks.value.length, gridOptions.value))
const pagedTracks = computed(() =>
  paginateSeries(chartTracks.value, currentPage.value, gridOptions.value),
)

const yAxisCharacterWidth = 7
const yAxisTickPadding = 7
const yAxisOuterPadding = 4
const yAxisLabelGap = 6
const yAxisLabelBandWidth = 24
const yAxisExponentGap = 4
const minimumPlotWidth = 120

const yAxisMetrics = computed(() => {
  const axisText = chartTracks.value.map((track) => {
    const scale = scaleLinear(track.yDomain, [1, 0]).nice()
    const [axisMin, axisMax] = scale.domain()
    const values = scale.ticks(10)
    return {
      exponentLabel: formatScientificAxisExponent(axisMin, axisMax),
      tickLabels: values.map((value) => formatScientificAxisLabel(value, { axisMin, axisMax })),
    }
  })
  const formattedTickLabels = axisText.flatMap(({ tickLabels }) => tickLabels)
  const maximumCharacterCount = Math.max(1, ...formattedTickLabels.map((label) => label.length))
  const tickTextWidth = maximumCharacterCount * yAxisCharacterWidth
  const maximumExponentWidth = Math.max(
    0,
    ...axisText.map(({ exponentLabel }) => (exponentLabel?.length ?? 0) * yAxisCharacterWidth),
  )
  const exponentClearance = maximumExponentWidth ? maximumExponentWidth + yAxisExponentGap : 0
  const tickClearance = tickTextWidth + yAxisTickPadding + exponentClearance + yAxisOuterPadding
  const labelCenterX = -(
    yAxisTickPadding +
    tickTextWidth +
    exponentClearance +
    yAxisLabelGap +
    yAxisLabelBandWidth / 2
  )
  const fullClearance =
    tickTextWidth +
    yAxisTickPadding +
    exponentClearance +
    yAxisLabelGap +
    yAxisLabelBandWidth +
    yAxisOuterPadding

  return { tickClearance, fullClearance, labelCenterX }
})
const hasYAxisLabels = computed(() =>
  chartTracks.value.some(
    (track) => track.series.length === 1 && Boolean(track.series[0]?.name.trim() || props.yLabel),
  ),
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
const multiAxisClearance = computed(() =>
  chartTracks.value.reduce(
    (maximum, track) => {
      const clearance = measureTrackYAxisClearance(track, props.overlayMode)
      return {
        left: Math.max(maximum.left, clearance.left),
        right: Math.max(maximum.right, clearance.right),
      }
    },
    { left: 0, right: 0 },
  ),
)
const resolvedChartLeftMargin = computed(() =>
  props.overlayMode === 'multi-axis'
    ? Math.max(chartLeftMargin.value, multiAxisClearance.value.left)
    : chartLeftMargin.value,
)
const chartRightMargin = computed(() =>
  props.overlayMode === 'multi-axis'
    ? Math.max(margin.right, multiAxisClearance.value.right)
    : margin.right,
)
const innerWidth = computed(() =>
  Math.max(0, chartWidth.value - resolvedChartLeftMargin.value - chartRightMargin.value),
)
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
      props.overlayMode === 'multi-axis' && hasMultipleColumns && chartSeries.value.length
        ? Math.max(baseGap, multiAxisClearance.value.left + multiAxisClearance.value.right)
        : hasMultipleColumns && chartSeries.value.length
          ? hasYAxisLabels.value && canReserveLabelClearance
            ? fullGap
            : tickGap
          : baseGap,
    hideSecondaryLabels:
      props.overlayMode !== 'multi-axis' &&
      hasMultipleColumns &&
      hasYAxisLabels.value &&
      !canReserveLabelClearance,
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
  paddedDomain(chartTracks.value.flatMap((track) => track.xDomain)),
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
    pagedTracks.value.map(Boolean),
    yAxisLayout.value.horizontalGap,
  )
  return cells.map((cell, index) => ({ ...cell, series: pagedTracks.value[index] }))
})

const trackLayouts = computed<TrackLayout[]>(() =>
  buildTrackLayouts({
    cells: gridCells.value,
    grid: gridOptions.value,
    displayMode: props.displayMode,
    overlayMode: props.overlayMode,
    independentTransforms: independentTransforms.value,
    sharedZoomDomain: sharedZoomDomain.value,
    timeUnit: props.timeUnit,
    rendering: renderingOptions.value,
    hideSecondaryLabels: yAxisLayout.value.hideSecondaryLabels,
    yAxisLabelX: yAxisMetrics.value.labelCenterX,
    showCompactEmptyTracks: props.displayMode === 'compact' && hasWaveformData.value,
  }),
)

function annotationLayoutsForTrack(track: TrackLayout): AnnotationTrackLayout[] {
  return track.seriesList.map((series) => ({
    ...track,
    series,
    yScale:
      track.seriesPaths.find((seriesPath) => seriesPath.series.id === series.id)?.yScale ??
      track.yScale,
  }))
}

function resolveSeriesYScale(track: TrackLayout, seriesId: string) {
  return (
    track.seriesPaths.find((seriesPath) => seriesPath.series.id === seriesId)?.yScale ??
    track.yScale
  )
}

const annotationTrackLayouts = computed<AnnotationTrackLayout[]>(() =>
  trackLayouts.value.flatMap(annotationLayoutsForTrack),
)

const renderedAnnotations = computed(() =>
  props.annotationsVisible
    ? layoutAnnotations(
        props.annotations,
        annotationTrackLayouts.value,
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
  if (chartTracks.value.length === 1) return props.frameNumber
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
  if (!overlay) return { x: chartWidth.value / 2, y: chartHeight.value / 2 }
  const [pointerX, pointerY] = pointer(event, overlay)
  const track = trackIndex === undefined ? undefined : trackLayouts.value[trackIndex]
  return {
    x: resolvedChartLeftMargin.value + (track ? track.left + pointerX : pointerX),
    y: titleAreaHeight.value + margin.top + (track ? track.top + pointerY : pointerY),
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
        margin.top +
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
  const draft = annotationInteraction.editorDraft.value
  const candidate = editorSeriesOptions.value.find((item) => item.seriesId === seriesId)
  const track = trackLayouts.value.find((item) =>
    item.seriesList.some((series) => series.id === seriesId),
  )
  const series = track?.seriesList.find((item) => item.id === seriesId)
  const point =
    series && draft ? interpolateAnnotationPoint(series.points, draft.annotation.x) : null
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
  if (!props.annotationsVisible || activeInteractionMode.value !== 'annotation') return
  const context = resolveAnnotationCandidates(event, trackIndex)
  if (!context) return
  const nearby = nearbyCandidates(context.candidates)
  if (!nearby.length) return
  event.preventDefault()
  event.stopPropagation()
  beginCreate(nearby[0], context.editorAnchor, context.candidates)
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

function editContextAnnotation() {
  const context = annotationInteraction.contextMenu.value
  const annotationId = context?.annotationId
  const annotation = props.annotations.find((item) => item.id === annotationId)
  if (annotation) {
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
  hoveredSeriesPoints.value = track.seriesList.flatMap((series) => {
    const point = nearestPoint(series, xValue)
    return point ? [{ ...series, trackIndex, point }] : []
  })
  hoveredTrackIndex.value = trackIndex
  hoverPosition.value = {
    x: resolvedChartLeftMargin.value + track.left + pointerX,
    y: titleAreaHeight.value + margin.top + track.top + pointerY,
  }
  emit('point-hover', hoveredSeriesPoints.value[0]?.point ?? null)
}

function handleSharedPointerMove(event: PointerEvent) {
  if (!sharedOverlayElement.value || !trackLayouts.value.length) return
  const [pointerX, pointerY] = pointer(event, sharedOverlayElement.value)
  const referenceTrack = resolveTrackAtPointer(pointerX, pointerY) ?? trackLayouts.value[0]
  if (!referenceTrack) return
  const localPointerX = Math.max(0, Math.min(referenceTrack.width, pointerX - referenceTrack.left))
  const xValue = referenceTrack.xScale.invert(localPointerX)
  hoveredSeriesPoints.value = trackLayouts.value.flatMap((track) =>
    track.seriesList.flatMap((series) => {
      const point = nearestPoint(series, xValue)
      return point ? [{ ...series, trackIndex: track.index, point }] : []
    }),
  )
  hoveredTrackIndex.value = null
  hoverPosition.value = {
    x: resolvedChartLeftMargin.value + pointerX,
    y: titleAreaHeight.value + margin.top + pointerY,
  }
  emit('point-hover', hoveredPoint.value)
}

function resetViewport() {
  sharedTransform.value = zoomIdentity
  independentTransforms.value = chartTracks.value.map(() => zoomIdentity)
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
    independentTransforms.value = pagedTracks.value.map(() => zoomIdentity)
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
    () => chartTracks.value.length,
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

function measureTitle() {
  if (!titleVisible.value || !titleMeasureElement.value) {
    measuredTitleWidth.value = 0
    measuredTitleHeight.value = 0
    return
  }
  const bounds = titleMeasureElement.value.getBoundingClientRect()
  measuredTitleWidth.value = titleMeasureElement.value.scrollWidth || bounds.width
  measuredTitleHeight.value = titleMeasureElement.value.scrollHeight || bounds.height
}

watch(
  [resolvedTitleText, titleVisible, titleMeasureStyle],
  async () => {
    measuredTitleWidth.value = 0
    measuredTitleHeight.value = 0
    await nextTick()
    measureTitle()
  },
  { immediate: true },
)

onMounted(() => {
  if (!container.value) return
  resizeObserver.value = new ResizeObserver(([entry]) => {
    observedWidth.value = Math.max(0, entry?.contentRect.width ?? 0)
    observedHeight.value = Math.max(0, entry?.contentRect.height ?? 0)
    void nextTick(measureTitle)
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
    :style="containerStyle"
    :data-display-mode="displayMode"
    :data-interaction-mode="activeInteractionMode"
    :data-overlay-mode="overlayMode"
    :data-chart-left-margin="resolvedChartLeftMargin"
    :data-title-area-height="titleAreaHeight"
    @contextmenu.capture="handleNativeContextMenu"
  >
    <div
      v-if="titleVisible"
      class="waveform-chart__title-area"
      :style="titleAreaStyle"
      role="heading"
      aria-level="2"
    >
      <span
        ref="titleMeasureElement"
        class="waveform-chart__title-measure"
        :style="titleMeasureStyle"
        aria-hidden="true"
      >
        {{ resolvedTitleText }}
      </span>
      <span class="waveform-chart__title-visual" :style="titleVisualStyle">
        <span
          class="waveform-chart__title-text"
          :style="titleTextStyle"
          :data-title-scale="titleLayout.scale"
          :data-title-wrapped="titleLayout.wrapped || undefined"
        >
          {{ resolvedTitleText }}
        </span>
      </span>
    </div>

    <svg
      ref="svgElement"
      class="waveform-chart__svg"
      :width="chartWidth"
      :height="drawingHeight"
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

      <g :transform="`translate(${resolvedChartLeftMargin}, ${margin.top})`">
        <g v-if="displayMode !== 'compact'" class="waveform-chart__grid-slots" aria-hidden="true">
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
          :frame-style="frameStyle"
          :time-unit="timeUnit"
          :y-label="yLabel"
          :legend-position="legendPosition"
          :legend-orientation="legendOrientation"
          :legend-background-color="legendBackgroundColor"
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
        :x="chartWidth / 2"
        :y="drawingHeight / 2"
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
      :total="chartTracks.length"
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
      :container-width="chartWidth"
      :container-height="chartHeight"
    />
  </div>
</template>

<style scoped>
.waveform-chart {
  box-sizing: border-box;
  position: relative;
  min-width: 0;
  min-height: 180px;
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

.waveform-chart__title-area {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  padding: 0 24px;
  overflow: hidden;
  background: #fff;
}

.waveform-chart__title-measure {
  position: absolute;
  display: block;
  visibility: hidden;
  pointer-events: none;
}

.waveform-chart__title-visual {
  position: relative;
  flex: 0 0 auto;
  min-width: 0;
  overflow: visible;
}

.waveform-chart__title-text {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  overflow: visible;
  line-height: 1.2;
  transform-origin: center;
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

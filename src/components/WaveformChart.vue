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
import { hasMinimumVisibleXValues } from '../core/rendering'
import { formatScientificAxisExponent, formatScientificAxisLabel, paddedDomain } from '../utils'
import { useAnimationFrameThrottle } from './utils/useAnimationFrameThrottle'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
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
  type WaveformZeroLineOptions,
  type WaveformZoomEndPayload,
} from './data/types'
import {
  ANNOTATION_AMBIGUITY_DISTANCE,
  ANNOTATION_HIT_RADIUS,
  interpolateAnnotationPoint,
  findAnnotationSeriesCandidates,
  layoutAnnotations,
  useWaveformAnnotationInteraction,
  type AnnotationEditorAnchor,
  WaveformAnnotationContextMenu,
  WaveformAnnotationLayer,
  type AnnotationHit,
  type AnnotationSeriesCandidate,
  type AnnotationSeriesInfo,
  type AnnotationTrackLayout,
} from './annotation'
import { WaveformTooltip } from './interaction'
import { WaveformLegend, WaveformTrack } from './rendering'
import {
  channelColors,
  margin as chartMargin,
  minimumHeight as chartMinimumHeight,
  Y_AXIS_CHARACTER_WIDTH,
  Y_AXIS_TICK_PADDING,
  Y_AXIS_OUTER_PADDING,
  Y_AXIS_LABEL_GAP,
  Y_AXIS_LABEL_BAND_WIDTH,
  MINIMUM_PLOT_WIDTH,
  WHEEL_ZOOM_DEBOUNCE_MS,
  MINIMUM_SELECTION_SIZE,
  ZOOM_CONSTRAINTS,
  TITLE_DEFAULT_FONT_SIZE,
  TITLE_CHAR_WIDTH_RATIO,
  TITLE_LINE_HEIGHT,
  ZERO_LINE_DEFAULTS,
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
import {
  buildTrackLayouts,
  findClosestTrackAtPointer,
  measureTrackYAxisClearance,
  Y_AXIS_EXPONENT_GAP,
} from './core/layout'
import { calculateRotatedTitleLayout, TITLE_AREA_HORIZONTAL_PADDING } from './core/title'
import { usePreparedWaveformSeries } from './core/useWaveformData'
import WaveformAnnotationEditor from './annotation/WaveformAnnotationEditor.vue'
import { useWaveformInstanceId } from '../utils/waveformId'

const xPointBisector = bisector<WaveformPoint, number>((point) => point.x)

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
    pannable?: boolean
    minZoomSpan?: number
    minVisiblePoints?: number
    initialXDomain?: [number, number]
    initialXDomains?: Record<string, [number, number]>
    timeUnit?: 's' | 'ms'
    frameNumber?: string | number
    frameStyle?: WaveformFrameStyle
    annotations?: WaveformAnnotation[]
    annotationsVisible?: boolean
    interactionMode?: WaveformInteractionMode
    grid?: WaveformGridOptions
    rendering?: WaveformRenderingOptions
    title?: WaveformTitleOptions
    legend?: WaveformLegendOptions
    hiddenSeriesIds?: string[]
    defaultHiddenSeriesIds?: string[]
    cleanView?: boolean
    zeroLine?: WaveformZeroLineOptions
  }>(),
  {
    displayMode: 'independent',
    overlayMode: 'single-axis',
    yLabel: '幅值',
    lineColor: '#0960bd',
    showTooltip: true,
    zoomable: true,
    pannable: false,
    minVisiblePoints: 0,
    timeUnit: 'ms',
    frameNumber: undefined,
    annotations: () => [],
    annotationsVisible: true,
    interactionMode: undefined,
    grid: () => ({ rowCount: 2, columnCount: 1, showPagination: true }),
    rendering: () => ({}),
    legend: () => ({ position: 'top-right', orientation: 'auto' }),
    defaultHiddenSeriesIds: () => [],
    cleanView: false,
    zeroLine: () => ({ visible: false }),
  },
)

const emit = defineEmits<{
  'point-hover': [point: WaveformPoint | null]
  'zoom-change': [domain: [number, number]]
  'zoom-end': [payload: WaveformZoomEndPayload]
  'zoom-reset': []
  'update:annotations': [annotations: WaveformAnnotation[]]
  'update:hidden-series-ids': [ids: string[]]
  'series-visibility-change': [
    payload: {
      seriesId: string
      visible: boolean
      hiddenSeriesIds: string[]
    },
  ]
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
const sharedYDomains = ref<Record<string, [number, number]>>({})
const independentYDomains = ref<Record<number, [number, number]>>({})
const hoveredSeriesPoints = ref<HoveredSeriesPoint[]>([])
const hoveredTrackIndex = ref<number | null>(null)
const hoverPosition = ref({ x: 0, y: 0 })
const suppressHoverUntilMove = ref(false)
const currentPage = ref(1)
const resizeObserver = shallowRef<ResizeObserver>()
const zoomBehaviors = new Map<number | 'shared', ZoomBehavior<SVGRectElement, unknown>>()
const clipPathId = useWaveformInstanceId('waveform-clip')
const internalHiddenSeriesIds = ref(new Set(props.defaultHiddenSeriesIds))
const annotationInteraction = useWaveformAnnotationInteraction()
const editorSeriesOptions = ref<AnnotationSeriesCandidate[]>([])
let generatedAnnotationId = 0
let synchronizingZoomTransform = false
let pendingSharedZoomTransform: ZoomTransform | null = null
type ZoomGestureKind = 'wheel'
let pendingSharedZoomGesture: ZoomGestureKind | null = null
let lastSharedZoomGesture: ZoomGestureKind | null = null
const pendingIndependentZoomTransforms = new Map<number, ZoomTransform>()
const pendingIndependentZoomGestures = new Map<number, ZoomGestureKind>()
const lastIndependentZoomGestures = new Map<number, ZoomGestureKind>()
const lastZoomedTrackIndexes = new Set<number>()
const zoomThrottle = useAnimationFrameThrottle()
const hoverThrottle = useAnimationFrameThrottle()
const wheelZoomDebounceMs = WHEEL_ZOOM_DEBOUNCE_MS
let wheelZoomEndTimer: ReturnType<typeof setTimeout> | undefined
const preparedSeries = usePreparedWaveformSeries(() => props.data, handleDataReferenceChange)

interface SelectionState {
  trackIndex: number
  independent: boolean
  overlay: SVGRectElement
  startX: number
  startY: number
  currentX: number
  currentY: number
  pointerId: number
  mode: 'box' | 'pan'
  xDomain: [number, number]
  yDomains: Record<string, [number, number]>
}

const selection = ref<SelectionState | null>(null)
const spacePressed = ref(false)
const pointerInsideChart = ref(false)
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

function handleInteractionKeyDown(event: KeyboardEvent) {
  if (event.code !== 'Space' || !props.pannable || !pointerInsideChart.value) return
  const target = event.target
  if (
    target instanceof Element &&
    target.closest('button, input, select, textarea, [contenteditable]:not([contenteditable="false"])')
  ) {
    return
  }
  spacePressed.value = true
  event.preventDefault()
}

function handleInteractionKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    spacePressed.value = false
  }
}

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
const isCleanView = computed(() => props.cleanView === true)
const resolvedZeroLine = computed(() => {
  const width = props.zeroLine?.width
  return {
    visible: props.zeroLine?.visible === true,
    color: props.zeroLine?.color || ZERO_LINE_DEFAULTS.COLOR,
    width: typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : ZERO_LINE_DEFAULTS.WIDTH,
    dash: props.zeroLine?.dash ?? ZERO_LINE_DEFAULTS.DASH,
  }
})
const legendBackgroundColor = computed(
  () => props.legend?.backgroundColor || 'rgba(255, 255, 255, 0.7)',
)
const legendInteractive = computed(() => props.legend?.interactive === true)
const hiddenSeriesIdSet = computed(() =>
  props.hiddenSeriesIds === undefined
    ? internalHiddenSeriesIds.value
    : new Set(props.hiddenSeriesIds),
)
const resolvedHiddenSeriesIds = computed(() => Array.from(hiddenSeriesIdSet.value))
function resolveLegendPosition(trackId: string): WaveformLegendPosition {
  return props.legend?.trackPositions?.[trackId] ?? props.legend?.position ?? 'top-right'
}

function resolveLegendOrientation(
  position: WaveformLegendPosition,
): Exclude<WaveformLegendOrientation, 'auto'> {
  const orientation = props.legend?.orientation ?? 'auto'
  if (orientation !== 'auto') return orientation
  return position === 'top' || position === 'bottom' ? 'horizontal' : 'vertical'
}
const resolvedTitleText = computed(() => props.title?.text.trim() ?? '')
const titleAreaReserved = computed(
  () =>
    Boolean(props.title) && props.title?.visible !== false && resolvedTitleText.value.length > 0,
)
const titleVisible = computed(() => titleAreaReserved.value && !isCleanView.value)
const titleFontSize = computed(() => {
  const fontSize = props.title?.textStyle?.fontSize
  return Number.isFinite(fontSize) && (fontSize ?? 0) > 0 ? (fontSize as number) : TITLE_DEFAULT_FONT_SIZE
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
  lineHeight: String(TITLE_LINE_HEIGHT),
}))
const estimatedTitleWidth = computed(() => {
  const letterSpacing = Number.parseFloat(props.title?.textStyle?.letterSpacing ?? '')
  const spacingWidth = Number.isFinite(letterSpacing)
    ? Math.max(0, resolvedTitleText.value.length - 1) * letterSpacing
    : 0
  return Math.max(1, resolvedTitleText.value.length * titleFontSize.value * TITLE_CHAR_WIDTH_RATIO + spacingWidth)
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
    naturalHeight: measuredTitleHeight.value || titleFontSize.value * TITLE_LINE_HEIGHT,
    availableWidth: titleAvailableWidth.value,
    rotation: titleRotation.value,
  }),
)
const titleAreaHeight = computed(() => (titleAreaReserved.value ? titleLayout.value.areaHeight : 0))
const chartTopMargin = computed(() => margin.top)
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
  return Array.from(groupedSeries, ([id, series]) => {
    const visibleSeries = series.filter((item) => !hiddenSeriesIdSet.value.has(item.id))
    const xDomainValues: number[] = []
    const yDomainValues: number[] = []
    visibleSeries.forEach((item) => {
      xDomainValues.push(item.xDomain[0], item.xDomain[1])
      yDomainValues.push(item.yDomain[0], item.yDomain[1])
    })
    return {
      id,
      series,
      visibleSeries,
      xDomain: paddedDomain(xDomainValues),
      yDomain: paddedDomain(yDomainValues),
    }
  })
})
const gridOptions = computed(() => normalizeGridOptions(props.grid))
const renderingOptions = computed(() => resolveWaveformRenderingOptions(props.rendering))
const pageCount = computed(() => getPageCount(chartTracks.value.length, gridOptions.value))
const pagedTracks = computed(() =>
  paginateSeries(chartTracks.value, currentPage.value, gridOptions.value),
)

// 使用从常量文件导入的值
const yAxisCharacterWidth = Y_AXIS_CHARACTER_WIDTH
const yAxisTickPadding = Y_AXIS_TICK_PADDING
const yAxisOuterPadding = Y_AXIS_OUTER_PADDING
const yAxisLabelGap = Y_AXIS_LABEL_GAP
const yAxisLabelBandWidth = Y_AXIS_LABEL_BAND_WIDTH
const minimumPlotWidth = MINIMUM_PLOT_WIDTH

const yAxisMetrics = computed(() => {
  const axisText = chartTracks.value
    .filter((track) => track.visibleSeries.length > 0)
    .map((track) => {
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
  const exponentClearance = maximumExponentWidth ? maximumExponentWidth + Y_AXIS_EXPONENT_GAP : 0
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
    (track) =>
      track.visibleSeries.length === 1 &&
      Boolean(track.visibleSeries[0]?.name.trim() || props.yLabel),
  ),
)
const hasVisibleWaveformData = computed(() =>
  chartTracks.value.some((track) => track.visibleSeries.length > 0),
)
const chartLeftMargin = computed(() =>
  Math.max(
    margin.left,
    hasYAxisLabels.value
      ? yAxisMetrics.value.fullClearance
      : hasVisibleWaveformData.value
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
      props.overlayMode === 'multi-axis' && hasMultipleColumns && hasVisibleWaveformData.value
        ? Math.max(baseGap, multiAxisClearance.value.left + multiAxisClearance.value.right)
        : hasMultipleColumns && hasVisibleWaveformData.value
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
const activeInteractionMode = computed(() => props.interactionMode)
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

const sharedXDomain = computed(() => {
  const values: number[] = []
  chartTracks.value.forEach((track) => {
    if (track.visibleSeries.length) values.push(track.xDomain[0], track.xDomain[1])
  })
  return paddedDomain(values)
})
const initialXDomain = computed<[number, number]>(() => {
  const domain = props.initialXDomain
  if (
    domain &&
    Number.isFinite(domain[0]) &&
    Number.isFinite(domain[1]) &&
    domain[0] !== domain[1]
  ) {
    return domain[0] < domain[1] ? domain : [domain[1], domain[0]]
  }
  return sharedXDomain.value
})
function resolveInitialTrackDomain(track: TrackLayout): [number, number] {
  const configuredDomain =
    props.initialXDomains?.[track.series.trackId ?? track.series.id] ??
    props.initialXDomains?.[track.series.id] ??
    props.initialXDomain
  if (
    configuredDomain &&
    Number.isFinite(configuredDomain[0]) &&
    Number.isFinite(configuredDomain[1]) &&
    configuredDomain[0] !== configuredDomain[1]
  ) {
    return configuredDomain[0] < configuredDomain[1]
      ? configuredDomain
      : [configuredDomain[1], configuredDomain[0]]
  }
  return paddedDomain(track.seriesList.flatMap((series) => series.xDomain))
}
const sharedZoomDomain = computed(
  () =>
    sharedTransform.value
      .rescaleX(scaleLinear(initialXDomain.value, [0, innerWidth.value]))
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
    initialXDomain: props.initialXDomain ? initialXDomain.value : undefined,
    initialXDomains: props.initialXDomains,
    yDomains:
      props.displayMode === 'independent'
        ? Object.fromEntries(
            chartTracks.value.flatMap((track, index) => {
              const domain = independentYDomains.value[index]
              return domain ? [[track.id, domain]] : []
            }),
          )
        : sharedYDomains.value,
    timeUnit: props.timeUnit,
    rendering: renderingOptions.value,
    hideSecondaryLabels: isCleanView.value || yAxisLayout.value.hideSecondaryLabels,
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
  cancelPendingHover()
  pendingSharedZoomTransform = event.transform
  pendingSharedZoomGesture = 'wheel'
  scheduleZoomCommit()
  scheduleWheelZoomEnd()
}

function handleIndependentZoom(event: D3ZoomEvent<SVGRectElement, unknown>, trackIndex: number) {
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

  if (pendingIndependentZoomTransforms.size) {
    const nextTransforms = [...independentTransforms.value]
    const changedTrackIndexes = Array.from(pendingIndependentZoomTransforms.keys())
    // Clear stale track indexes before recording the new batch
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
    changedTrackIndexes.forEach((trackIndex) => {
      const track = trackLayouts.value.find((item) => item.index === trackIndex)
      if (!track) return
      const domain = track.xScale.domain()
      emit('zoom-change', [domain[0], domain[1]])
    })
  }
}

function scheduleZoomCommit() {
  zoomThrottle.schedule(() => commitPendingZoom())
}

function flushPendingZoom() {
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
  }, wheelZoomDebounceMs)
}

function emitZoomEnd() {
  if (props.displayMode === 'independent') {
    lastZoomedTrackIndexes.forEach((trackIndex) => {
      const gesture = lastIndependentZoomGestures.get(trackIndex)
      if (gesture !== 'wheel') return
      const track = trackLayouts.value.find((item) => item.index === trackIndex)
      if (!track) return
      const domain = track.xScale.domain() as [number, number]
      emit('zoom-end', {
        start: domain[0],
        end: domain[1],
        yStart: track.yScale.domain()[0],
        yEnd: track.yScale.domain()[1],
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
  const payload: WaveformZoomEndPayload = { start: domain[0], end: domain[1], gesture: 'wheel' }
  if (visibleTracks.length === 1) {
    const yDomain = visibleTracks[0]?.yScale.domain()
    payload.yStart = yDomain?.[0]
    payload.yEnd = yDomain?.[1]
  } else {
    payload.yRanges = Object.fromEntries(
      visibleTracks.map((track) => [
        track.series.trackId ?? track.series.id,
        track.yScale.domain() as [number, number],
      ]),
    )
  }
  emit('zoom-end', payload)
  lastSharedZoomGesture = null
}

function cancelPendingZoom() {
  // Clear all pending zoom state to prevent stale emissions
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

function clearZoomBindings() {
  cancelPendingZoom()
  const svg = svgElement.value
  if (svg) {
    const overlays = svg.querySelectorAll<SVGRectElement>('.waveform-chart__overlay')
    overlays.forEach((overlay) => {
      if (overlay) select(overlay).on('.zoom', null)
    })
  }
  zoomBehaviors.clear()
}

function resolveMaximumZoomScale(domain: [number, number]): number {
  const minZoomSpan = props.minZoomSpan
  if (!Number.isFinite(minZoomSpan) || (minZoomSpan ?? 0) <= 0) return ZOOM_CONSTRAINTS.DEFAULT_MAX_SCALE
  const domainSpan = Math.abs(domain[1] - domain[0])
  if (!Number.isFinite(domainSpan) || domainSpan <= 0) return ZOOM_CONSTRAINTS.MIN_SCALE
  return Math.min(ZOOM_CONSTRAINTS.DEFAULT_MAX_SCALE, Math.max(ZOOM_CONSTRAINTS.MIN_SCALE, domainSpan / (minZoomSpan ?? domainSpan)))
}

function canZoomTrack(track: TrackLayout): boolean {
  const minimum = Number(props.minVisiblePoints)
  return hasMinimumVisibleXValues(
    track.seriesList,
    track.xScale.domain() as [number, number],
    minimum,
  )
}

function canZoomSharedTracks(): boolean {
  const tracks = trackLayouts.value.filter((track) => track.hasVisibleSeries)
  return tracks.length > 0 && tracks.every(canZoomTrack)
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

  if (!sharedOverlayElement.value) return
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
  const overlay = sharedOverlayElement.value
  if (overlay) {
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
}

function cancelPendingHover() {
  hoverThrottle.cancel()
}

function scheduleHover(update: () => void) {
  hoverThrottle.schedule(update)
}

function hoveredPointsMatch(nextPoints: HoveredSeriesPoint[]): boolean {
  return (
    hoveredSeriesPoints.value.length === nextPoints.length &&
    nextPoints.every((point, index) => {
      const current = hoveredSeriesPoints.value[index]
      return (
        current?.id === point.id &&
        current.trackIndex === point.trackIndex &&
        current.point === point.point
      )
    })
  )
}

function commitHover(
  nextPoints: HoveredSeriesPoint[],
  trackIndex: number | null,
  position: { x: number; y: number },
) {
  if (!hoveredPointsMatch(nextPoints)) hoveredSeriesPoints.value = nextPoints
  hoveredTrackIndex.value = trackIndex
  hoverPosition.value = position
  // Emit using the updated hoveredSeriesPoints to avoid race condition
  emit('point-hover', hoveredSeriesPoints.value[0]?.point ?? null)
}

function clearHover() {
  cancelPendingHover()
  hoveredSeriesPoints.value = []
  hoveredTrackIndex.value = null
  emit('point-hover', null)
}

function beginAnnotationDrag() {
  suppressHoverUntilMove.value = true
  clearHover()
}

function endAnnotationDrag(cancelled: boolean = false) {
  // 如果是 cancel，立即恢复悬停而不是等待下次移动
  if (cancelled) {
    suppressHoverUntilMove.value = false
  } else {
    suppressHoverUntilMove.value = true
  }
  clearHover()
}

function consumeHoverSuppression(): boolean {
  if (!suppressHoverUntilMove.value) return false
  suppressHoverUntilMove.value = false
  clearHover()
  return true
}

function nearestPoint(series: DisplaySeries, xValue: number): WaveformPoint | undefined {
  const index = xPointBisector.center(series.points, xValue)
  return series.points[index]
}

function makeAnnotationId(): string {
  generatedAnnotationId += 1
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `annotation-${Date.now()}-${generatedAnnotationId}`
}

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
    series && draft
      ? interpolateAnnotationPoint(series.points, draft.annotation.x, series.lineType)
      : null
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

function handleAnnotationMove(annotationId: string, offsetX: number, offsetY: number) {
  const annotation = props.annotations.find((item) => item.id === annotationId)
  if (!annotation || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return
  emit(
    'update:annotations',
    props.annotations.map((item) =>
      item.id === annotationId
        ? {
            ...item,
            labelOffsetX: offsetX,
            labelOffsetY: offsetY,
          }
        : item,
    ),
  )
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
  if (selection.value?.trackIndex === trackIndex && selection.value.independent) {
    updateViewportDrag(event)
    return
  }
  if (consumeHoverSuppression()) return
  const overlay = event.currentTarget as SVGRectElement | null
  if (!overlay) return
  const [pointerX, pointerY] = pointer(event, overlay)
  // 捕获轨道对象以避免竞态条件
  const track = trackLayouts.value[trackIndex]
  if (!track || !track.hasVisibleSeries) return

  scheduleHover(() => {
    // 重新验证轨道仍然有效且有可见系列
    const currentTrack = trackLayouts.value[trackIndex]
    if (!currentTrack || !currentTrack.hasVisibleSeries || currentTrack !== track) return

    const xValue = track.xScale.invert(Math.max(0, Math.min(innerWidth.value, pointerX)))
    const nextPoints = track.seriesList.flatMap((series) => {
      const point = nearestPoint(series, xValue)
      return point ? [{ ...series, trackIndex, point }] : []
    })
    commitHover(nextPoints, trackIndex, {
      x: resolvedChartLeftMargin.value + track.left + pointerX,
      y: titleAreaHeight.value + chartTopMargin.value + track.top + pointerY,
    })
  })
}

function handleSharedPointerMove(event: PointerEvent) {
  if (selection.value?.overlay === event.currentTarget) {
    updateViewportDrag(event)
    return
  }
  if (consumeHoverSuppression()) return
  if (!sharedOverlayElement.value || !trackLayouts.value.length) return
  const [pointerX, pointerY] = pointer(event, sharedOverlayElement.value)
  scheduleHover(() => {
    const resolvedTrack = resolveTrackAtPointer(pointerX, pointerY)
    const fallbackTrack = trackLayouts.value.find((track) => track.hasVisibleSeries)
    const referenceTrack = resolvedTrack ?? fallbackTrack
    if (!referenceTrack) return
    const localPointerX = Math.max(
      0,
      Math.min(referenceTrack.width, pointerX - referenceTrack.left),
    )
    const xValue = referenceTrack.xScale.invert(localPointerX)
    const nextPoints = trackLayouts.value.flatMap((track) =>
      track.seriesList.flatMap((series) => {
        const point = nearestPoint(series, xValue)
        return point ? [{ ...series, trackIndex: track.index, point }] : []
      }),
    )
    commitHover(nextPoints, null, {
      x: resolvedChartLeftMargin.value + pointerX,
      y: titleAreaHeight.value + chartTopMargin.value + pointerY,
    })
  })
}

const minimumSelectionSize = MINIMUM_SELECTION_SIZE

function transformForDomain(
  domain: [number, number],
  baseDomain: [number, number],
  width: number,
): ZoomTransform {
  const baseSpan = baseDomain[1] - baseDomain[0]
  const span = domain[1] - domain[0]
  if (!Number.isFinite(baseSpan) || !Number.isFinite(span) || baseSpan <= 0 || span <= 0) {
    return zoomIdentity
  }
  const scale = baseSpan / span
  const baseScale = scaleLinear(baseDomain, [0, width])
  return zoomIdentity.translate(-scale * baseScale(domain[0]), 0).scale(scale)
}

function resolveMinimumZoomSpan(boundary: [number, number]): number {
  const boundarySpan = Math.abs(boundary[1] - boundary[0])
  if (!Number.isFinite(boundarySpan) || boundarySpan <= 0) return 0
  const configured = props.minZoomSpan
  if (Number.isFinite(configured) && (configured ?? 0) > 0) {
    return Math.min(boundarySpan, configured as number)
  }
  return boundarySpan / 40
}

function constrainZoomDomain(
  domain: [number, number],
  boundary: [number, number],
): [number, number] {
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

function clampDomain(domain: [number, number], boundary: [number, number]): [number, number] {
  const span = domain[1] - domain[0]
  const boundarySpan = boundary[1] - boundary[0]
  if (span >= boundarySpan) return [...boundary]
  if (domain[0] < boundary[0]) return [boundary[0], boundary[0] + span]
  if (domain[1] > boundary[1]) return [boundary[1] - span, boundary[1]]
  return domain
}

function currentYDomains(): Record<string, [number, number]> {
  return Object.fromEntries(
    trackLayouts.value.map((track) => [
      track.series.trackId ?? track.series.id,
      track.yScale.domain() as [number, number],
    ]),
  )
}

function beginViewportDrag(event: PointerEvent, trackIndex: number, independent: boolean) {
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

function beginSharedViewportDrag(event: PointerEvent) {
  if (!sharedOverlayElement.value) return
  const [x, y] = pointer(event, sharedOverlayElement.value)
  const track =
    resolveTrackAtPointer(x, y) ?? trackLayouts.value.find((item) => item.hasVisibleSeries)
  if (track) beginViewportDrag(event, track.index, false)
}

function updateViewportDrag(event: PointerEvent) {
  const active = selection.value
  if (!active || event.pointerId !== active.pointerId) return
  const track = trackLayouts.value.find((item) => item.index === active.trackIndex)
  if (!track) return
  const [rawX, rawY] = pointer(event, active.overlay)
  active.currentX = Math.max(0, Math.min(active.independent ? track.width : innerWidth.value, rawX))
  active.currentY = Math.max(
    0,
    Math.min(active.independent ? track.height : innerHeight.value, rawY),
  )
  selection.value = { ...active }
  if (active.mode === 'pan') applyPan(active, track)
  event.preventDefault()
}

function applyPan(active: SelectionState, track: TrackLayout) {
  const width = track.width || 1
  const height = track.height || 1
  const dx = active.currentX - active.startX
  const dy = active.currentY - active.startY
  const xSpan = active.xDomain[1] - active.xDomain[0]
  const initialDomain = active.independent ? resolveInitialTrackDomain(track) : initialXDomain.value
  const nextX = clampDomain(
    [active.xDomain[0] - (dx / width) * xSpan, active.xDomain[1] - (dx / width) * xSpan],
    initialDomain,
  )
  if (active.independent) {
    const next = [...independentTransforms.value]
    next[track.index] = transformForDomain(nextX, initialDomain, width)
    independentTransforms.value = next
  } else {
    sharedTransform.value = transformForDomain(nextX, initialDomain, innerWidth.value)
  }

  const targets = active.independent ? [track] : trackLayouts.value
  targets.forEach((target) => {
    const key = target.series.trackId ?? target.series.id
    const source = active.yDomains[key] ?? (target.yScale.domain() as [number, number])
    const boundary = chartTracks.value.find((item) => item.id === key)?.yDomain ?? source
    const ySpan = source[1] - source[0]
    const nextY = clampDomain(
      [source[0] + (dy / height) * ySpan, source[1] + (dy / height) * ySpan],
      boundary,
    )
    if (active.independent)
      independentYDomains.value = { ...independentYDomains.value, [target.index]: nextY }
    else sharedYDomains.value = { ...sharedYDomains.value, [key]: nextY }
  })
  emit('zoom-change', nextX)
}

function finishViewportDrag(event: PointerEvent) {
  const active = selection.value
  if (!active || event.pointerId !== active.pointerId) return
  updateViewportDrag(event)
  active.overlay.releasePointerCapture?.(active.pointerId)
  selection.value = null
  if (active.mode === 'pan') {
    void nextTick(configureZoom)
    return
  }
  const width = Math.abs(active.currentX - active.startX)
  if (width < minimumSelectionSize) return
  applyBoxZoom(active)
}

function cancelViewportDrag(event?: PointerEvent) {
  const active = selection.value
  if (!active || (event && event.pointerId !== active.pointerId)) return
  active.overlay.releasePointerCapture?.(active.pointerId)
  selection.value = null
}

function applyBoxZoom(active: SelectionState) {
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
  if (right - left < minimumSelectionSize) return
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
  const yRanges: Record<string, [number, number]> = Object.fromEntries(
    targets.map((target) => [
      target.series.trackId ?? target.series.id,
      target.yScale.domain() as [number, number],
    ]),
  )

  emit('zoom-change', xDomain)
  const payload: WaveformZoomEndPayload = { start: xDomain[0], end: xDomain[1], gesture: 'box' }
  if (active.independent) {
    const yDomain = yRanges[track.series.trackId ?? track.series.id]
    payload.trackIndex = track.index
    payload.seriesIds = track.seriesList.map((series) => series.id)
    payload.yStart = yDomain?.[0]
    payload.yEnd = yDomain?.[1]
  } else if (targets.length === 1) {
    const yDomain = Object.values(yRanges)[0]
    payload.yStart = yDomain?.[0]
    payload.yEnd = yDomain?.[1]
  } else payload.yRanges = yRanges
  emit('zoom-end', payload)
  void nextTick(configureZoom)
}

function resetViewport(trackIndex?: number) {
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

function requestViewportReset(event: MouseEvent) {
  if (!props.zoomable || !isZoomMode.value) return
  event.preventDefault()
  resetViewport()
  emit('zoom-reset')
}

defineExpose({ resetViewport })

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

watch(
  [
    innerWidth,
    innerHeight,
    () => props.zoomable,
    () => props.minZoomSpan,
    () => props.initialXDomain,
    () => props.initialXDomains,
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
  if (props.displayMode === 'independent') {
    const currentTransforms = independentTransforms.value
    independentTransforms.value = chartTracks.value.map(
      (_track, index) => currentTransforms[index] ?? zoomIdentity,
    )
    clearHover()
    editorSeriesOptions.value = []
    void nextTick(configureZoom)
    return
  }

  clearHover()
  editorSeriesOptions.value = []
  void nextTick(configureZoom)
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
    // 修复：不仅检查系列是否被隐藏，还要检查系列是否从数据中完全移除
    if (draftSeriesId) {
      const seriesExists = chartSeries.value.some((series) => series.id === draftSeriesId)
      const seriesHidden = hiddenSeriesIdSet.value.has(draftSeriesId)
      if (!seriesExists || seriesHidden) {
        annotationInteraction.closeEditor()
      }
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
</script>

<template>
  <div
    ref="container"
    class="waveform-chart"
    :class="[
      `waveform-chart--${displayMode}`,
      `waveform-chart--interaction-${activeInteractionMode}`,
      {
        'waveform-chart--clean': isCleanView,
        'waveform-chart--panning': selection?.mode === 'pan',
      },
    ]"
    :style="containerStyle"
    :data-display-mode="displayMode"
    :data-interaction-mode="activeInteractionMode"
    :data-overlay-mode="overlayMode"
    :data-chart-left-margin="resolvedChartLeftMargin"
    :data-title-area-height="titleAreaHeight"
    @pointerenter="pointerInsideChart = true"
    @pointerleave="pointerInsideChart = false"
    @contextmenu.capture="handleNativeContextMenu"
  >
    <div
      v-if="titleAreaReserved"
      class="waveform-chart__title-area"
      :style="titleAreaStyle"
      :role="titleVisible ? 'heading' : undefined"
      :aria-level="titleVisible ? 2 : undefined"
      :aria-hidden="isCleanView || undefined"
    >
      <span
        ref="titleMeasureElement"
        class="waveform-chart__title-measure"
        :style="titleMeasureStyle"
        aria-hidden="true"
      >
        {{ resolvedTitleText }}
      </span>
      <span v-if="titleVisible" class="waveform-chart__title-visual" :style="titleVisualStyle">
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
      @dblclick="requestViewportReset"
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

      <g :transform="`translate(${resolvedChartLeftMargin}, ${chartTopMargin})`">
        <g
          v-if="displayMode !== 'compact' && !isCleanView"
          class="waveform-chart__grid-slots"
          aria-hidden="true"
        >
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
        <rect
          v-if="displayMode !== 'independent' && trackLayouts.length && hasVisibleWaveformData"
          ref="sharedOverlayElement"
          class="waveform-chart__overlay waveform-chart__overlay--shared"
          :class="{
            'is-zoomable': zoomable && isZoomMode,
            'is-annotating': activeInteractionMode === 'annotation',
          }"
          :width="innerWidth"
          :height="innerHeight"
          @pointermove="handleSharedPointerMove"
          @pointerdown="beginSharedViewportDrag"
          @pointerup="finishViewportDrag"
          @pointercancel="cancelViewportDrag"
          @pointerleave="clearHover"
          @click="handleAnnotationClick"
          @contextmenu="handleAnnotationContextMenu"
        />

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
          :clean-view="isCleanView"
          :zero-line="resolvedZeroLine"
          :time-unit="timeUnit"
          :y-label="yLabel"
          :hovered-point="hoveredSeriesPoints.find((p) => p.trackIndex === track.index)"
          @pointer-move="handleIndependentPointerMove($event, track.index)"
          @pointer-down="beginViewportDrag($event, track.index, true)"
          @pointer-up="finishViewportDrag"
          @pointer-cancel="cancelViewportDrag"
          @pointer-leave="clearHover"
          @click="handleAnnotationClick($event, track.index)"
          @contextmenu="handleAnnotationContextMenu($event, track.index)"
        />

        <rect
          v-if="selectionBox && selection?.mode === 'box'"
          class="waveform-chart__zoom-selection"
          :x="selectionBox.x"
          :y="selectionBox.y"
          :width="selectionBox.width"
          :height="selectionBox.height"
          aria-hidden="true"
        />

        <WaveformAnnotationLayer
          v-if="!isCleanView"
          :annotations="renderedAnnotations"
          :visible="annotationsVisible"
          @contextmenu="handleExistingAnnotationContextMenu"
          @drag-start="beginAnnotationDrag"
          @move="handleAnnotationMove"
          @drag-end="endAnnotationDrag"
        />

        <g v-if="!isCleanView" class="waveform-chart__legend-layer">
          <g
            v-for="track in trackLayouts"
            :key="`legend-${track.index}-${track.series.name}`"
            class="waveform-chart__legend-track"
            :data-legend-track-index="track.index"
            :data-legend-track-id="track.id"
            :transform="`translate(${track.left}, ${track.top})`"
          >
            <WaveformLegend
              v-if="!track.isEmpty && track.legendSeries.length > 1"
              :series="track.legendSeries"
              :position="resolveLegendPosition(track.id)"
              :orientation="resolveLegendOrientation(resolveLegendPosition(track.id))"
              :background-color="legendBackgroundColor"
              :interactive="legendInteractive"
              :hidden-series-ids="resolvedHiddenSeriesIds"
              :width="track.width ?? innerWidth"
              :height="track.height"
              @toggle="toggleSeriesVisibility"
            />
          </g>
        </g>

        <text
          v-if="resolvedXLabel && !isCleanView"
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
      v-if="gridOptions.showPagination && pageCount > 1 && !isCleanView"
      class="waveform-chart__pagination"
      aria-label="波形分页"
      :current="currentPage"
      :page-size="getPageSize(gridOptions)"
      :total="chartTracks.length"
      :show-size-changer="false"
      :show-quick-jumper="false"
      @change="goToPage"
    />

    <WaveformAnnotationEditor
      v-if="annotationInteraction.editorDraft.value && !isCleanView"
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
      v-if="!isCleanView"
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

.waveform-chart--clean {
  border-color: transparent;
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
  cursor: crosshair;
}

.waveform-chart--panning .waveform-chart__overlay.is-zoomable {
  cursor: grabbing;
}

.waveform-chart__zoom-selection {
  fill: rgb(22 119 255 / 14%);
  stroke: #1677ff;
  stroke-width: 1;
  pointer-events: none;
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

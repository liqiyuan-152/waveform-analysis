<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import 'vue3-colorpicker/style.css'

import {
  type WaveformAnnotation,
  type WaveformAxesOptions,
  type WaveformData,
  type WaveformDisplayMode,
  type WaveformFrameStyle,
  type WaveformGridTrackLines,
  type WaveformInteractionMode,
  type WaveformLineStyle,
  type WaveformLegendOrientation,
  type WaveformLegendPosition,
  type WaveformOverlayMode,
  type WaveformPlotMargin,
  type WaveformTitleOptions,
  type WaveformZoomEndPayload,
  type WaveformZeroLineOptions,
} from './components'
import { normalizeWaveformSeries } from './core'
import { createSimulatedWaveformData } from './data/simulatedWaveforms'
import DemoChartHost from './demo/DemoChartHost.vue'
import DemoControlPanel from './demo/DemoControlPanel.vue'
import type { DemoChartModel, DemoControlPanelModel } from './demo/types'
import { useDemoXAxisLabelControls } from './demo/useDemoXAxisLabelControls'

const fullChartData = createSimulatedWaveformData()
const displayMode = ref<WaveformDisplayMode>('independent')
const overlayMode = ref<WaveformOverlayMode>('single-axis')
const rowCount = ref(4)
const columnCount = ref(1)
const frameBorderColor = ref('#1f2937')
const frameBorderWidth = ref(2)
const frameBorderStyle = ref<NonNullable<WaveformFrameStyle['borderStyle']>>('solid')
const frameBackgroundColor = ref('rgba(255, 255, 255, 0)')
const frameWatermarkVisible = ref(true)
const horizontalGridVisible = ref(true)
const horizontalGridColor = ref('#dfe5ef')
const verticalGridVisible = ref(true)
const verticalGridColor = ref('#dfe5ef')
const xAxisLineVisible = ref(false)
const yAxisLineVisible = ref(false)
const { controlModel: xAxisLabelControlModel, xAxisLabelFormatter } = useDemoXAxisLabelControls()
const annotations = ref<WaveformAnnotation[]>([])
const annotationsVisible = ref(true)
const cleanView = ref(false)
const presentationMode = ref(false)
const showTooltip = ref(true)
const plotMarginTop = ref(18)
const plotMarginBottom = ref(52)
const zeroLineVisible = ref(false)
const zeroLineColor = ref('#98a2b3')
const zeroLineWidth = ref(1)
const zeroLineDash = ref('6 4')
const interactionMode = ref<WaveformInteractionMode>('zoom')
const legendPosition = ref<WaveformLegendPosition>('top-right')
const legendOrientation = ref<WaveformLegendOrientation>('auto')
const legendBackgroundColor = ref('rgba(255, 255, 255, 0.7)')
const hiddenSeriesIds = ref<string[]>([])
const titleVisible = ref(true)
const titleText = ref('模拟波形分析')
const titleAlign = ref<NonNullable<WaveformTitleOptions['align']>>('center')
const titleFontFamily = ref('"Microsoft YaHei", "微软雅黑", sans-serif')
const titleFontSize = ref(14)
const titleRotation = ref(0)
const titleColor = ref('#1f2937')
const titleBold = ref(false)
const titleItalic = ref(false)
const titleUnderline = ref(false)
const controlsOpen = ref(false)
const legendPositionOptions: Array<{ label: string; value: WaveformLegendPosition }> = [
  { label: '左上', value: 'top-left' },
  { label: '上', value: 'top' },
  { label: '右上', value: 'top-right' },
  { label: '右', value: 'right' },
  { label: '右下', value: 'bottom-right' },
  { label: '下', value: 'bottom' },
  { label: '左下', value: 'bottom-left' },
  { label: '左', value: 'left' },
]
const legendOrientationOptions: Array<{ label: string; value: WaveformLegendOrientation }> = [
  { label: '自动', value: 'auto' },
  { label: '水平', value: 'horizontal' },
  { label: '垂直', value: 'vertical' },
]
const frameBorderStyleOptions = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点虚线', value: 'dotted' },
]
const zeroLineDashOptions = [
  { label: '虚线', value: '6 4' },
  { label: '点划线', value: '2 3' },
  { label: '实线', value: '' },
]
const titleAlignOptions: Array<{
  label: string
  value: NonNullable<WaveformTitleOptions['align']>
}> = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' },
]
const titleFontFamilyOptions = [
  { label: '微软雅黑', value: '"Microsoft YaHei", "微软雅黑", sans-serif' },
  { label: '宋体', value: 'SimSun, serif' },
  { label: '黑体', value: 'SimHei, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Consolas', value: 'Consolas, monospace' },
]
const frameStyle = computed<WaveformFrameStyle>(() => ({
  borderColor: frameBorderColor.value,
  borderWidth: frameBorderWidth.value,
  borderStyle: frameBorderStyle.value,
  backgroundColor: frameBackgroundColor.value,
}))
const axes = computed<WaveformAxesOptions>(() => ({
  x: {
    lineVisible: xAxisLineVisible.value,
    ...(xAxisLabelFormatter.value ? { labelFormatter: xAxisLabelFormatter.value } : {}),
  },
  y: { lineVisible: yAxisLineVisible.value },
}))
const zeroLine = computed<WaveformZeroLineOptions>(() => ({
  visible: zeroLineVisible.value,
  color: zeroLineColor.value,
  width: zeroLineWidth.value,
  dash: zeroLineDash.value,
}))
const plotMargin = computed<WaveformPlotMargin>(() => ({
  top: plotMarginTop.value,
  bottom: plotMarginBottom.value,
}))

const initialXValues = normalizeWaveformSeries(fullChartData).flatMap((series) =>
  series.points.map((point) => point.x),
)
const [initialXMinimum, initialXMaximum] = initialXValues.reduce<[number, number]>(
  ([minimum, maximum], value) => [Math.min(minimum, value), Math.max(maximum, value)],
  [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
)
const initialXDomainValue: [number, number] | undefined =
  Number.isFinite(initialXMinimum) && Number.isFinite(initialXMaximum)
    ? [initialXMinimum, initialXMaximum]
    : undefined
// Keep the full source domain stable while viewport data windows are replaced.
const initialXDomain = ref<[number, number] | undefined>(initialXDomainValue)
const chartData = ref<WaveformData>(fullChartData)
const lineStyleOverrides = ref<Record<string, WaveformLineStyle>>({})
const selectedSeriesId = ref(
  fullChartData.kind === 'series' ? (fullChartData.series[0]?.id ?? '') : '',
)
const lineStyleOptions: Array<{ label: string; value: WaveformLineStyle }> = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点划线', value: 'dash-dot' },
]
const seriesStyleOptions = computed(() =>
  normalizeWaveformSeries(chartData.value).map((series) => ({
    label: series.name || series.id,
    value: series.id,
  })),
)
const selectedLineStyle = computed<WaveformLineStyle>({
  get: () => lineStyleOverrides.value[selectedSeriesId.value] ?? 'solid',
  set: (value) => {
    if (!selectedSeriesId.value) return
    lineStyleOverrides.value = { ...lineStyleOverrides.value, [selectedSeriesId.value]: value }
  },
})
const displayChartData = computed<WaveformData>(() => {
  if (chartData.value.kind !== 'series') return chartData.value
  return {
    ...chartData.value,
    series: chartData.value.series.map((series) => ({
      ...series,
      ...(lineStyleOverrides.value[series.id ?? '']
        ? { lineStyle: lineStyleOverrides.value[series.id ?? ''] }
        : {}),
    })),
  }
})
const gridTrackLines = computed<WaveformGridTrackLines>(() =>
  Object.fromEntries(
    normalizeWaveformSeries(displayChartData.value).map((series) => [
      series.trackId ?? series.id,
      {
        horizontal: horizontalGridVisible.value,
        vertical: verticalGridVisible.value,
        horizontalColor: horizontalGridColor.value,
        verticalColor: verticalGridColor.value,
      },
    ]),
  ),
)
const demoChartHostRef = ref<{ resetViewport: (trackIndex?: number) => void }>()

let zoomRequestSequence = 0

function filterWaveformData(data: WaveformData, start: number, end: number): WaveformData {
  const lower = Math.min(start, end)
  const upper = Math.max(start, end)
  if (data.kind === 'samples') return data
  if (data.kind === 'points') {
    return {
      kind: 'points',
      points: data.points.filter((point) => point.x >= lower && point.x <= upper),
    }
  }
  return {
    kind: 'series',
    series: data.series.map((series) => ({
      ...series,
      data:
        series.data.kind === 'points'
          ? {
              kind: 'points',
              points: series.data.points.filter((point) => point.x >= lower && point.x <= upper),
            }
          : series.data,
    })),
  }
}

function mergeIndependentWindow(
  currentData: WaveformData,
  responseData: WaveformData,
  seriesIds: string[],
): WaveformData {
  if (currentData.kind !== 'series' || responseData.kind !== 'series') return responseData
  const responseById = new Map(responseData.series.map((series) => [series.id, series]))
  const changedIds = new Set(seriesIds)
  return {
    kind: 'series',
    series: currentData.series.map((series) =>
      series.id && changedIds.has(series.id) ? (responseById.get(series.id) ?? series) : series,
    ),
  }
}

async function handleZoomEnd(payload: WaveformZoomEndPayload) {
  // Demo-only sequence number cancellation. Production code should use AbortController
  // to cancel in-flight requests when a newer zoom gesture arrives.
  const requestSequence = ++zoomRequestSequence
  await new Promise((resolve) => window.setTimeout(resolve, 80))
  if (requestSequence !== zoomRequestSequence) return

  // Demo-only stand-in for the backend response. Production code should replace this
  // with a request using payload.start/payload.end and the optional channel metadata.
  const responseData = filterWaveformData(fullChartData, payload.start, payload.end)
  chartData.value =
    payload.trackIndex !== undefined && payload.seriesIds?.length
      ? mergeIndependentWindow(chartData.value, responseData, payload.seriesIds)
      : responseData
}

function resetWaveformViewport() {
  zoomRequestSequence += 1
  chartData.value = fullChartData
  initialXDomain.value = initialXDomainValue
  demoChartHostRef.value?.resetViewport()
}
const titleOptions = computed<WaveformTitleOptions>(() => ({
  visible: titleVisible.value,
  text: titleText.value,
  align: titleAlign.value,
  textStyle: {
    color: titleColor.value,
    fontSize: titleFontSize.value,
    fontFamily: titleFontFamily.value,
    rotation: titleRotation.value,
    fontWeight: titleBold.value ? 700 : 400,
    fontStyle: titleItalic.value ? 'italic' : 'normal',
    textDecoration: titleUnderline.value ? 'underline' : 'none',
  },
}))
function closeControls() {
  controlsOpen.value = false
}

function resetTitleTextStyle() {
  titleBold.value = false
  titleItalic.value = false
  titleUnderline.value = false
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeControls()
}

onMounted(() => window.addEventListener('keydown', handleWindowKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleWindowKeydown))

const controlPanelModel = reactive({
  controlsOpen,
  displayMode,
  overlayMode,
  showTooltip,
  plotMarginTop,
  plotMarginBottom,
  cleanView,
  presentationMode,
  selectedSeriesId,
  selectedLineStyle,
  lineStyleOptions,
  seriesStyleOptions,
  zeroLineVisible,
  zeroLineColor,
  zeroLineWidth,
  zeroLineDash,
  zeroLineDashOptions,
  rowCount,
  columnCount,
  horizontalGridVisible,
  horizontalGridColor,
  verticalGridVisible,
  verticalGridColor,
  xAxisLineVisible,
  yAxisLineVisible,
  ...xAxisLabelControlModel,
  frameBorderColor,
  frameBackgroundColor,
  frameBorderWidth,
  frameBorderStyle,
  frameBorderStyleOptions,
  frameWatermarkVisible,
  titleVisible,
  titleText,
  titleAlign,
  titleAlignOptions,
  titleFontFamily,
  titleFontFamilyOptions,
  titleFontSize,
  titleBold,
  titleItalic,
  titleUnderline,
  titleRotation,
  titleColor,
  legendPosition,
  legendPositionOptions,
  legendOrientation,
  legendOrientationOptions,
  legendBackgroundColor,
  closeControls,
  resetTitleTextStyle,
  resetWaveformViewport,
}) satisfies DemoControlPanelModel

const chartModel = reactive({
  data: displayChartData,
  initialXDomain,
  displayMode,
  overlayMode,
  rowCount,
  columnCount,
  gridTrackLines,
  title: titleOptions,
  legendPosition,
  legendOrientation,
  legendBackgroundColor,
  frameStyle,
  axes,
  cleanView,
  presentationMode,
  showTooltip,
  plotMargin,
  zeroLine,
  frameWatermarkVisible,
  annotations,
  annotationsVisible,
  interactionMode,
  hiddenSeriesIds,
  handleZoomEnd,
  resetWaveformViewport,
}) satisfies DemoChartModel
</script>

<template>
  <main class="workspace">
    <DemoControlPanel :model="controlPanelModel" />
    <DemoChartHost ref="demoChartHostRef" :model="chartModel" />
  </main>
</template>

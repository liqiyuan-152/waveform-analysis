<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
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
  type WaveformZeroLineOptions,
} from './components'
import { normalizeWaveformSeries } from './core'
import { createSimulatedWaveformData } from './demo/data/simulatedWaveforms'
import DemoChartHost from './demo/DemoChartHost.vue'
import DemoControlPanel from './demo/DemoControlPanel.vue'
import type { DemoChartModel, DemoControlPanelModel } from './demo/types'
import { useDemoXAxisLabelControls } from './demo/useDemoXAxisLabelControls'
import { remoteWindowLoaderKey } from './demo/remoteWaveformLoader'
import { useRemoteWaveformWindow } from './demo/useRemoteWaveformWindow'

const demoPreset = new URLSearchParams(window.location.search).get('demo')
const compactNineDemo = demoPreset === 'compact-nine'
const compactFourteenDemo = demoPreset === 'compact-fourteen'
const fullChartData = createSimulatedWaveformData(compactFourteenDemo ? 14 : undefined)
if (compactNineDemo && fullChartData.kind === 'series') {
  const trackIds = [...new Set(fullChartData.series.map((series) => series.trackId ?? series.id))]
  const demoTrackIds = new Set(trackIds.slice(0, 9))
  fullChartData.series = fullChartData.series.filter((series) =>
    demoTrackIds.has(series.trackId ?? series.id),
  )
}
const displayMode = ref<WaveformDisplayMode>(
  compactNineDemo || compactFourteenDemo ? 'compact' : 'independent',
)
const overlayMode = ref<WaveformOverlayMode>('single-axis')
const rowCount = ref(compactNineDemo ? 5 : 4)
const columnCount = ref(compactNineDemo || compactFourteenDemo ? 2 : 1)
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
const upperPaddingEnabled = ref(true)
const lowerPaddingEnabled = ref(true)
const maximumTickVisible = ref(true)
const minimumTickVisible = ref(true)
const upperPaddingPercent = ref(10)
const lowerPaddingPercent = ref(10)
const { controlModel: xAxisLabelControlModel, xAxisLabelFormatter } = useDemoXAxisLabelControls()
const annotations = ref<WaveformAnnotation[]>([])
const annotationsVisible = ref(true)
const cleanView = ref(false)
const presentationMode = ref(false)
const showTooltip = ref(true)
const integerZoom = ref(true)
const plotMarginTop = ref(10)
const plotMarginBottom = ref(44)
const zeroLineVisible = ref(true)
const zeroLineColor = ref('#ff0000')
const zeroLineWidth = ref(1)
const zeroLineOpacity = ref(0.5)
const zeroLineDash = ref('6 4')
const toolbarVisible = ref(true)
const interactionMode = ref<WaveformInteractionMode>('zoom')
const legendPosition = ref<WaveformLegendPosition>('top-right')
const legendOrientation = ref<WaveformLegendOrientation>('auto')
const legendBackgroundColor = ref('rgba(255, 255, 255, 0.7)')
const hiddenSeriesIds = ref<string[]>([])
const titleVisible = ref(true)
const titleText = ref('模拟波形分析')
const titleAlign = ref<NonNullable<WaveformTitleOptions['align']>>('center')
const titleFontFamily = ref('"Microsoft YaHei", "微软雅黑", sans-serif')
const titleFontSize = ref(18)
const titleRotation = ref(0)
const titleColor = ref('#1f2937')
const titleBold = ref(true)
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
  y: {
    lineVisible: yAxisLineVisible.value,
    upperPaddingEnabled: upperPaddingEnabled.value,
    lowerPaddingEnabled: lowerPaddingEnabled.value,
    maximumTickVisible: maximumTickVisible.value,
    minimumTickVisible: minimumTickVisible.value,
    upperPaddingRatio: upperPaddingPercent.value / 100,
    lowerPaddingRatio: lowerPaddingPercent.value / 100,
  },
}))
const zeroLine = computed<WaveformZeroLineOptions>(() => ({
  visible: zeroLineVisible.value,
  color: zeroLineColor.value,
  width: zeroLineWidth.value,
  opacity: zeroLineOpacity.value,
  dash: zeroLineDash.value,
}))
const plotMargin = computed<WaveformPlotMargin>(() => ({
  top: plotMarginTop.value,
  bottom: plotMarginBottom.value,
}))

const demoChartHostRef = ref<{ resetViewport: (trackIndex?: number) => void }>()
const sourceData = shallowRef<WaveformData>(fullChartData)
const remoteWindow = useRemoteWaveformWindow(sourceData, {
  loadWindow: inject(remoteWindowLoaderKey, undefined),
  resetViewport: (trackIndex) => demoChartHostRef.value?.resetViewport(trackIndex),
})
const {
  chartData,
  initialXDomain,
  recordDomain,
  minZoomSpan,
  loading,
  errors,
  handleZoomIntent,
  handleZoomChange,
  handleZoomEnd,
  handlePanEnd,
  resetWaveformViewport,
  retry,
} = remoteWindow
onMounted(() => void resetWaveformViewport())
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
  normalizeWaveformSeries(sourceData.value).map((series) => ({
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
    normalizeWaveformSeries(sourceData.value).map((series) => [
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
  toolbarVisible,
  controlsOpen,
  displayMode,
  overlayMode,
  showTooltip,
  integerZoom,
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
  zeroLineOpacity,
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
  upperPaddingEnabled,
  lowerPaddingEnabled,
  maximumTickVisible,
  minimumTickVisible,
  upperPaddingPercent,
  lowerPaddingPercent,
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
  toolbarVisible,
  data: displayChartData,
  initialXDomain,
  recordDomain,
  minZoomSpan,
  loading,
  errors,
  retry,
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
  integerZoom,
  plotMargin,
  zeroLine,
  frameWatermarkVisible,
  annotations,
  annotationsVisible,
  interactionMode,
  hiddenSeriesIds,
  handleZoomIntent,
  handleZoomChange,
  handleZoomEnd,
  handlePanEnd,
  resetWaveformViewport,
}) satisfies DemoChartModel
</script>

<template>
  <main class="workspace">
    <DemoControlPanel :model="controlPanelModel" />
    <DemoChartHost ref="demoChartHostRef" :model="chartModel" />
  </main>
</template>

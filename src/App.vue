<script setup lang="ts">
import { Button, Input, InputNumber, Radio, Select, Switch } from 'ant-design-vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ColorPicker } from 'vue3-colorpicker'
import 'vue3-colorpicker/style.css'

import {
  WaveformChart,
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
  type WaveformTitleOptions,
  type WaveformZoomEndPayload,
  type WaveformZeroLineOptions,
} from './components'
import { normalizeWaveformSeries } from './core'
import { createSimulatedWaveformData } from './data/simulatedWaveforms'

const fullChartData = createSimulatedWaveformData()
const displayMode = ref<WaveformDisplayMode>('independent')
const overlayMode = ref<WaveformOverlayMode>('single-axis')
const rowCount = ref(4)
const columnCount = ref(1)
const frameBorderColor = ref('#1f2937')
const frameBorderWidth = ref(1)
const frameBorderStyle = ref<NonNullable<WaveformFrameStyle['borderStyle']>>('solid')
const frameBackgroundColor = ref('rgba(255, 255, 255, 0)')
const frameWatermarkVisible = ref(true)
const horizontalGridVisible = ref(true)
const horizontalGridColor = ref('#dfe5ef')
const verticalGridVisible = ref(true)
const verticalGridColor = ref('#dfe5ef')
const xAxisLineVisible = ref(false)
const yAxisLineVisible = ref(false)
const annotations = ref<WaveformAnnotation[]>([])
const annotationsVisible = ref(true)
const cleanView = ref(false)
const showTooltip = ref(true)
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
  x: { lineVisible: xAxisLineVisible.value },
  y: { lineVisible: yAxisLineVisible.value },
}))
const zeroLine = computed<WaveformZeroLineOptions>(() => ({
  visible: zeroLineVisible.value,
  color: zeroLineColor.value,
  width: zeroLineWidth.value,
  dash: zeroLineDash.value,
}))

const initialXValues = normalizeWaveformSeries(fullChartData).flatMap((series) =>
  series.points.map((point) => point.x),
)
const [initialXMinimum, initialXMaximum] = initialXValues.reduce<[number, number]>(
  ([minimum, maximum], value) => [Math.min(minimum, value), Math.max(maximum, value)],
  [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
)
const initialXSpan = initialXMaximum - initialXMinimum
const minZoomSpan =
  Number.isFinite(initialXSpan) && initialXSpan > 0 ? initialXSpan / 40 : undefined
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
const waveformChartRef = ref<{ resetViewport: (trackIndex?: number) => void }>()

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
  waveformChartRef.value?.resetViewport()
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
</script>

<template>
  <main class="workspace">
    <Button
      class="mobile-control-toggle"
      size="small"
      :aria-expanded="controlsOpen"
      aria-controls="waveform-control-panel"
      @click="controlsOpen = true"
    >
      控制面板
    </Button>

    <button
      v-if="controlsOpen"
      type="button"
      class="control-backdrop"
      aria-label="关闭控制面板"
      @click="closeControls"
    />

    <aside
      id="waveform-control-panel"
      class="control-panel"
      :class="{ 'is-open': controlsOpen }"
      aria-label="波形图控制"
    >
      <div class="control-panel__scroll">
        <Button class="control-panel__close" type="text" size="small" @click="closeControls">
          关闭
        </Button>

        <section class="control-section">
          <h2>显示方式</h2>
          <Radio.Group
            v-model:value="displayMode"
            class="display-mode-control"
            button-style="solid"
            size="small"
            aria-label="波形展示方式"
          >
            <Radio.Button value="independent">单独坐标</Radio.Button>
            <Radio.Button value="separated">多道分离</Radio.Button>
            <Radio.Button value="compact">多道紧凑</Radio.Button>
          </Radio.Group>
        </section>

        <section class="control-section">
          <h2>叠加方式</h2>
          <Radio.Group
            v-model:value="overlayMode"
            class="display-mode-control"
            button-style="solid"
            size="small"
            aria-label="波形叠加方式"
          >
            <Radio.Button value="single-axis">单值轴</Radio.Button>
            <Radio.Button value="multi-axis">多值轴</Radio.Button>
          </Radio.Group>
        </section>

        <section class="control-section">
          <h2>视图</h2>
          <Button block aria-label="重置波形视图" @click="resetWaveformViewport">重置视图</Button>
          <div class="auxiliary-style-controls" style="margin-top: 10px">
            <label class="frame-style-control frame-style-control--switch">
              <span>数值 Tooltip</span>
              <Switch v-model:checked="showTooltip" size="small" aria-label="显示数值 Tooltip" />
            </label>
            <label class="frame-style-control frame-style-control--switch">
              <span>净图</span>
              <Switch v-model:checked="cleanView" size="small" aria-label="净图模式" />
            </label>
          </div>
        </section>

        <section class="control-section">
          <h2>波形线型</h2>
          <label class="select-control">
            <span>波形</span>
            <Select
              v-model:value="selectedSeriesId"
              :options="seriesStyleOptions"
              size="small"
              aria-label="选择波形线型"
            />
          </label>
          <label class="select-control">
            <span>线型</span>
            <Select
              v-model:value="selectedLineStyle"
              :options="lineStyleOptions"
              size="small"
              aria-label="设置波形线型"
            />
          </label>
        </section>

        <section class="control-section">
          <div class="control-section__header">
            <h2>零值参考线</h2>
            <Switch v-model:checked="zeroLineVisible" size="small" aria-label="显示零值参考线" />
          </div>
          <div class="auxiliary-style-controls zero-line-controls" style="margin-top: 10px">
            <label class="frame-style-control">
              <span>颜色</span>
              <ColorPicker
                v-model:pure-color="zeroLineColor"
                aria-label="零值参考线颜色"
                use-type="pure"
                picker-type="chrome"
                format="hex"
                :disable-alpha="true"
                :blur-close="true"
              />
            </label>
            <label class="frame-style-control">
              <span>线宽</span>
              <InputNumber
                v-model:value="zeroLineWidth"
                :min="0.5"
                :max="10"
                :step="0.5"
                size="small"
                aria-label="零值参考线线宽"
              />
            </label>
            <label class="frame-style-control">
              <span>线型</span>
              <Select
                v-model:value="zeroLineDash"
                :options="zeroLineDashOptions"
                size="small"
                aria-label="零值参考线线型"
              />
            </label>
          </div>
        </section>

        <section class="control-section">
          <h2>图框布局</h2>
          <div class="grid-size-control" aria-label="波形网格尺寸">
            <InputNumber v-model:value="rowCount" :min="1" :max="10" size="small" />
            <span>行</span>
            <span class="control-separator">×</span>
            <InputNumber v-model:value="columnCount" :min="1" :max="10" size="small" />
            <span>列</span>
          </div>
        </section>

        <section class="control-section">
          <h2>网格与轴线</h2>
          <div class="grid-line-controls">
            <div class="grid-line-control">
              <span>水平网格</span>
              <Switch
                v-model:checked="horizontalGridVisible"
                size="small"
                aria-label="显示水平网格线"
              />
              <span class="grid-line-color-picker" role="group" aria-label="水平网格线颜色">
                <ColorPicker
                  v-model:pure-color="horizontalGridColor"
                  use-type="pure"
                  picker-type="chrome"
                  format="hex"
                  :disable-alpha="true"
                  :blur-close="true"
                />
              </span>
            </div>
            <div class="grid-line-control">
              <span>垂直网格</span>
              <Switch
                v-model:checked="verticalGridVisible"
                size="small"
                aria-label="显示垂直网格线"
              />
              <span class="grid-line-color-picker" role="group" aria-label="垂直网格线颜色">
                <ColorPicker
                  v-model:pure-color="verticalGridColor"
                  use-type="pure"
                  picker-type="chrome"
                  format="hex"
                  :disable-alpha="true"
                  :blur-close="true"
                />
              </span>
            </div>
            <div class="grid-line-control grid-line-control--switch-only">
              <span>横轴线</span>
              <Switch v-model:checked="xAxisLineVisible" size="small" aria-label="显示横轴线" />
            </div>
            <div class="grid-line-control grid-line-control--switch-only">
              <span>纵轴线</span>
              <Switch v-model:checked="yAxisLineVisible" size="small" aria-label="显示纵轴线" />
            </div>
          </div>
        </section>

        <section class="control-section">
          <h2>图框样式</h2>
          <div class="frame-style-controls">
            <label class="frame-style-control">
              <span>边框颜色</span>
              <ColorPicker
                v-model:pure-color="frameBorderColor"
                aria-label="图框边框颜色"
                use-type="pure"
                picker-type="chrome"
                format="rgb"
                :disable-alpha="false"
                :blur-close="true"
              />
            </label>
            <label class="frame-style-control">
              <span>背景颜色</span>
              <ColorPicker
                v-model:pure-color="frameBackgroundColor"
                aria-label="图框背景颜色"
                use-type="pure"
                picker-type="chrome"
                format="rgb"
                :disable-alpha="false"
                :blur-close="true"
              />
            </label>
            <label class="frame-style-control">
              <span>线宽</span>
              <InputNumber
                v-model:value="frameBorderWidth"
                :min="0"
                :max="10"
                :step="0.5"
                size="small"
                aria-label="图框线宽"
              />
            </label>
            <label class="frame-style-control">
              <span>线型</span>
              <Select
                v-model:value="frameBorderStyle"
                :options="frameBorderStyleOptions"
                size="small"
                aria-label="图框线型"
              />
            </label>
            <label class="frame-style-control frame-style-control--switch">
              <span>水印</span>
              <Switch
                v-model:checked="frameWatermarkVisible"
                size="small"
                aria-label="显示图框水印"
              />
            </label>
          </div>
        </section>

        <section class="control-section title-control-section">
          <div class="control-section__header">
            <h2>标题</h2>
            <Switch v-model:checked="titleVisible" size="small" aria-label="显示标题" />
          </div>

          <div class="title-controls">
            <label class="title-control title-control--wide">
              <span>标题名称</span>
              <Input v-model:value="titleText" size="small" aria-label="标题名称" />
            </label>
            <label class="title-control title-control--wide">
              <span>对齐方式</span>
              <Select
                v-model:value="titleAlign"
                :options="titleAlignOptions"
                size="small"
                aria-label="标题对齐方式"
              />
            </label>
            <label class="title-control">
              <span>字体</span>
              <Select
                v-model:value="titleFontFamily"
                :options="titleFontFamilyOptions"
                size="small"
                aria-label="标题字体"
              />
            </label>
            <label class="title-control">
              <span>字号</span>
              <InputNumber
                v-model:value="titleFontSize"
                :min="8"
                :max="72"
                :step="1"
                size="small"
                aria-label="标题字号"
              />
            </label>
            <div class="title-control">
              <span>字体样式</span>
              <div class="title-style-controls" role="group" aria-label="标题字体样式">
                <button
                  type="button"
                  aria-label="恢复标题常规样式"
                  title="恢复常规样式"
                  @click="resetTitleTextStyle"
                >
                  A
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': titleBold }"
                  :aria-pressed="titleBold"
                  aria-label="标题粗体"
                  title="粗体"
                  @click="titleBold = !titleBold"
                >
                  <b>B</b>
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': titleItalic }"
                  :aria-pressed="titleItalic"
                  aria-label="标题斜体"
                  title="斜体"
                  @click="titleItalic = !titleItalic"
                >
                  <i>I</i>
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': titleUnderline }"
                  :aria-pressed="titleUnderline"
                  aria-label="标题下划线"
                  title="下划线"
                  @click="titleUnderline = !titleUnderline"
                >
                  <u>U</u>
                </button>
              </div>
            </div>
            <label class="title-control">
              <span>旋转</span>
              <InputNumber
                v-model:value="titleRotation"
                :min="-180"
                :max="180"
                :step="1"
                addon-after="°"
                size="small"
                aria-label="标题旋转角度"
              />
            </label>
            <div class="title-control title-control--color">
              <span>颜色</span>
              <ColorPicker
                v-model:pure-color="titleColor"
                aria-label="标题颜色"
                use-type="pure"
                picker-type="chrome"
                format="hex"
                :disable-alpha="true"
                :blur-close="true"
              />
            </div>
          </div>
        </section>

        <section class="control-section">
          <h2>图例</h2>
          <label class="select-control">
            <span>位置</span>
            <Select
              v-model:value="legendPosition"
              :options="legendPositionOptions"
              size="small"
              aria-label="图例位置"
            />
          </label>
          <label class="select-control">
            <span>排列</span>
            <Select
              v-model:value="legendOrientation"
              :options="legendOrientationOptions"
              size="small"
              aria-label="图例排列"
            />
          </label>
          <label class="legend-color-control">
            <span>背景</span>
            <ColorPicker
              v-model:pure-color="legendBackgroundColor"
              aria-label="图例背景颜色"
              use-type="pure"
              picker-type="chrome"
              format="rgb"
              :disable-alpha="false"
              :blur-close="true"
            />
          </label>
        </section>
      </div>
    </aside>

    <section class="chart-panel">
      <WaveformChart
        ref="waveformChartRef"
        :data="displayChartData"
        :min-zoom-span="minZoomSpan"
        :min-visible-points="5"
        :initial-x-domain="initialXDomain"
        :display-mode="displayMode"
        :overlay-mode="overlayMode"
        :grid="{ rowCount, columnCount, showPagination: true, trackLines: gridTrackLines }"
        :title="titleOptions"
        :legend="{
          position: legendPosition,
          orientation: legendOrientation,
          backgroundColor: legendBackgroundColor,
          interactive: true,
        }"
        :frame-style="frameStyle"
        :axes="axes"
        :clean-view="cleanView"
        :show-tooltip="showTooltip"
        :zero-line="zeroLine"
        :frame-number="frameWatermarkVisible ? 1 : undefined"
        v-model:annotations="annotations"
        :annotations-visible="annotationsVisible"
        :interaction-mode="interactionMode"
        v-model:hidden-series-ids="hiddenSeriesIds"
        @zoom-end="handleZoomEnd"
        @zoom-reset="resetWaveformViewport"
      />
    </section>
  </main>
</template>

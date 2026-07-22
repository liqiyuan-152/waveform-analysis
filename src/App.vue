<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ColorPicker } from 'vue3-colorpicker'
import 'vue3-colorpicker/style.css'

import {
  WaveformChart,
  type WaveformAnnotation,
  type WaveformData,
  type WaveformDisplayMode,
  type WaveformFrameStyle,
  type WaveformInteractionMode,
  type WaveformLegendOrientation,
  type WaveformLegendPosition,
  type WaveformOverlayMode,
  type WaveformSeries,
  type WaveformTitleOptions,
  type WaveformZoomEndPayload,
  type WaveformZeroLineOptions,
} from './components'
import chartWaveformsJson from './data/chartWaveforms.json'
import demoWaveformsJson from './data/demoWaveforms.json'
import { normalizeWaveformSeries } from './core'

interface WaveformSourcePoint {
  x: number
  y: number
  error?: number
  lowerError?: number
  upperError?: number
}

interface WaveformSourceRow {
  chnl: string
  chnl_id: number
  dat_unit: string
  data: WaveformSourcePoint[]
  dev: number
  shot: number
  time?: number[]
  time_unit: 'ms'
}

const sourceRows = chartWaveformsJson as unknown as WaveformSourceRow[]
const displayMode = ref<WaveformDisplayMode>('independent')
const overlayMode = ref<WaveformOverlayMode>('single-axis')
const rowCount = ref(2)
const columnCount = ref(1)
const frameBorderColor = ref('#1f2937')
const frameBorderWidth = ref(1)
const frameBorderStyle = ref<'solid' | 'dashed'>('solid')
const frameBackgroundColor = ref('rgba(255, 255, 255, 0)')
const frameWatermarkVisible = ref(true)
const annotations = ref<WaveformAnnotation[]>([])
const annotationsVisible = ref(true)
const cleanView = ref(false)
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
const titleText = ref(`Shot:${sourceRows[0]?.shot ?? 4712}`)
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
const zeroLine = computed<WaveformZeroLineOptions>(() => ({
  visible: zeroLineVisible.value,
  color: zeroLineColor.value,
  width: zeroLineWidth.value,
  dash: zeroLineDash.value,
}))

const seriesStylePresets: Array<Pick<WaveformSeries, 'lineType' | 'pointType' | 'errorBar'>> = [
  { lineType: 'none', pointType: 'triangle', errorBar: { visible: true } },
  { lineType: 'linear', pointType: 'none' },
  { lineType: 'step-after', pointType: 'circle', errorBar: { visible: true } },
  { lineType: 'linear', pointType: 'diamond', errorBar: { visible: true } },
]

const waveformSeries: WaveformSeries[] = sourceRows.map((row, seriesIndex) => {
  const presetStyle = seriesStylePresets[seriesIndex % seriesStylePresets.length]!
  const style: Pick<WaveformSeries, 'lineType' | 'pointType' | 'errorBar'> =
    row.chnl === 'TEST_CH_4'
      ? { lineType: 'linear', pointType: 'circle', errorBar: { visible: false } }
      : presetStyle
  return {
    id: String(row.chnl_id),
    trackId:
      row.chnl.startsWith('TEST_CH_') && row.chnl !== 'TEST_CH_2'
        ? String(sourceRows[0]?.chnl_id ?? row.chnl_id)
        : undefined,
    name: row.chnl,
    unit: row.dat_unit,
    ...style,
    data: {
      kind: 'points',
      points: row.data,
    },
  }
})

const demoWaveforms = demoWaveformsJson as {
  stepDemoValues: Array<{
    id: string
    name: string
    color: string
    lineType: 'step-start' | 'step-middle' | 'step-end'
    values: number[]
  }>
  basicCurveDemoSeries: Array<{
    id: string
    name: string
    color: string
    lineType: 'none' | 'linear'
    pointType: 'circle' | 'none'
    points: Array<{ x: number; y: number }>
  }>
}

const stepDemoSeries: WaveformSeries[] = demoWaveforms.stepDemoValues.map((series) => ({
  id: series.id,
  trackId: 'step-demo',
  name: series.name,
  color: series.color,
  lineType: series.lineType,
  pointType: 'circle',
  data: {
    kind: 'points',
    points: series.values.map((y, index) => ({ x: index / 1000, y })),
  },
}))

const frameOneTrackId = String(sourceRows[0]?.chnl_id ?? 'frame-one')
const basicCurveDemoSeries: WaveformSeries[] = demoWaveforms.basicCurveDemoSeries.map((series) => ({
  id: series.id,
  trackId: frameOneTrackId,
  name: series.name,
  color: series.color,
  lineType: series.lineType,
  pointType: series.pointType,
  data: { kind: 'points', points: series.points },
}))
const frameOneSeries = waveformSeries.filter(
  (series) => series.id === frameOneTrackId || series.trackId === frameOneTrackId,
)
const remainingSeries = waveformSeries.filter((series) => !frameOneSeries.includes(series))
const fullChartData: WaveformData = {
  kind: 'series',
  series: [...frameOneSeries, ...basicCurveDemoSeries, ...stepDemoSeries, ...remainingSeries],
}
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

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeControls()
}

onMounted(() => window.addEventListener('keydown', handleWindowKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleWindowKeydown))
</script>

<template>
  <main class="workspace">
    <button
      type="button"
      class="mobile-control-toggle"
      :aria-expanded="controlsOpen"
      aria-controls="waveform-control-panel"
      @click="controlsOpen = true"
    >
      控制面板
    </button>

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
        <button class="control-panel__close" type="button" @click="closeControls">关闭</button>

        <section class="control-section">
          <h2>显示方式</h2>
          <div class="display-mode-control" role="radiogroup" aria-label="波形展示方式">
            <label
              ><input v-model="displayMode" type="radio" value="independent" /><span
                >单独坐标</span
              ></label
            >
            <label
              ><input v-model="displayMode" type="radio" value="separated" /><span
                >多道分离</span
              ></label
            >
            <label
              ><input v-model="displayMode" type="radio" value="compact" /><span
                >多道紧凑</span
              ></label
            >
          </div>
        </section>

        <section class="control-section">
          <h2>视图</h2>
          <button
            type="button"
            class="control-action control-action--block"
            aria-label="重置波形视图"
            @click="resetWaveformViewport"
          >
            重置视图
          </button>
          <div class="auxiliary-style-controls" style="margin-top: 10px">
            <label class="frame-style-control frame-style-control--switch">
              <span>净图</span>
              <input
                v-model="cleanView"
                class="native-switch"
                type="checkbox"
                role="switch"
                aria-label="净图模式"
                @click.stop
              />
            </label>
          </div>
        </section>

        <section class="control-section">
          <div class="control-section__header">
            <h2>零值参考线</h2>
            <input
              v-model="zeroLineVisible"
              class="native-switch"
              type="checkbox"
              role="switch"
              aria-label="显示零值参考线"
              @click.stop
            />
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
              <input
                v-model.number="zeroLineWidth"
                class="native-input"
                type="number"
                :min="0.5"
                :max="10"
                :step="0.5"
                aria-label="零值参考线线宽"
                @blur="zeroLineWidth = clampNumber(zeroLineWidth, 0.5, 10, 1)"
              />
            </label>
            <label class="frame-style-control">
              <span>线型</span>
              <select v-model="zeroLineDash" class="native-select" aria-label="零值参考线线型">
                <option
                  v-for="option in zeroLineDashOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>
        </section>

        <section class="control-section">
          <h2>叠加方式</h2>
          <div class="display-mode-control" role="radiogroup" aria-label="波形叠加方式">
            <label
              ><input v-model="overlayMode" type="radio" value="single-axis" /><span
                >单值轴</span
              ></label
            >
            <label
              ><input v-model="overlayMode" type="radio" value="multi-axis" /><span
                >多值轴</span
              ></label
            >
          </div>
        </section>

        <section class="control-section">
          <h2>图框布局</h2>
          <div class="grid-size-control" aria-label="波形网格尺寸">
            <input
              v-model.number="rowCount"
              class="native-input"
              type="number"
              min="1"
              max="10"
              step="1"
              aria-label="波形网格行数"
              @blur="rowCount = clampNumber(rowCount, 1, 10, 2)"
            />
            <span>行</span>
            <span class="control-separator">×</span>
            <input
              v-model.number="columnCount"
              class="native-input"
              type="number"
              min="1"
              max="10"
              step="1"
              aria-label="波形网格列数"
              @blur="columnCount = clampNumber(columnCount, 1, 10, 1)"
            />
            <span>列</span>
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
              <input
                v-model.number="frameBorderWidth"
                class="native-input"
                type="number"
                :min="0"
                :max="10"
                :step="0.5"
                aria-label="图框线宽"
                @blur="frameBorderWidth = clampNumber(frameBorderWidth, 0, 10, 1)"
              />
            </label>
            <label class="frame-style-control">
              <span>线型</span>
              <select v-model="frameBorderStyle" class="native-select" aria-label="图框线型">
                <option
                  v-for="option in frameBorderStyleOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="frame-style-control frame-style-control--switch">
              <span>水印</span>
              <input
                v-model="frameWatermarkVisible"
                class="native-switch"
                type="checkbox"
                role="switch"
                aria-label="显示图框水印"
                @click.stop
              />
            </label>
          </div>
        </section>

        <section class="control-section title-control-section">
          <div class="control-section__header">
            <h2>标题</h2>
            <input
              v-model="titleVisible"
              class="native-switch"
              type="checkbox"
              role="switch"
              aria-label="显示标题"
              @click.stop
            />
          </div>

          <div class="title-controls">
            <label class="title-control title-control--wide">
              <span>标题名称</span>
              <input v-model="titleText" class="native-input" type="text" aria-label="标题名称" />
            </label>
            <label class="title-control title-control--wide">
              <span>对齐方式</span>
              <select v-model="titleAlign" class="native-select" aria-label="标题对齐方式">
                <option
                  v-for="option in titleAlignOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="title-control">
              <span>字体</span>
              <select v-model="titleFontFamily" class="native-select" aria-label="标题字体">
                <option
                  v-for="option in titleFontFamilyOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="title-control">
              <span>字号</span>
              <input
                v-model.number="titleFontSize"
                class="native-input"
                type="number"
                :min="8"
                :max="72"
                :step="1"
                aria-label="标题字号"
                @blur="titleFontSize = clampNumber(titleFontSize, 8, 72, 14)"
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
              <input
                v-model.number="titleRotation"
                class="native-input"
                type="number"
                :min="-180"
                :max="180"
                :step="1"
                aria-label="标题旋转角度"
                @blur="titleRotation = clampNumber(titleRotation, -180, 180, 0)"
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
            <select v-model="legendPosition" class="native-select" aria-label="图例位置">
              <option
                v-for="option in legendPositionOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="select-control">
            <span>排列</span>
            <select v-model="legendOrientation" class="native-select" aria-label="图例排列">
              <option
                v-for="option in legendOrientationOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
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
        :data="chartData"
        :min-zoom-span="minZoomSpan"
        :min-visible-points="5"
        :initial-x-domain="initialXDomain"
        :display-mode="displayMode"
        :overlay-mode="overlayMode"
        :grid="{ rowCount, columnCount, showPagination: true }"
        :title="titleOptions"
        :legend="{
          position: legendPosition,
          orientation: legendOrientation,
          backgroundColor: legendBackgroundColor,
          interactive: true,
        }"
        :frame-style="frameStyle"
        :clean-view="cleanView"
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

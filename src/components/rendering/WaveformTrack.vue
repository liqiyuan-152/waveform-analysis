<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { axisBottom, axisLeft, axisRight, select } from 'd3'
import { formatAxisTime, formatScientificAxisLabel } from '../../utils'
import type { WaveformFrameStyle, WaveformZeroLineOptions } from '../../types'
import type { WaveformDisplayMode, WaveformInteractionMode } from '../data/types'
import type {
  DisplaySeries,
  HoveredSeriesPoint,
  TrackLayout,
  WaveformYAxisLayout,
} from '../core/types'
import WaveformSeriesLayer from './WaveformSeriesLayer.vue'

interface Props {
  /** 轨道布局信息 */
  track: TrackLayout
  /** clipPath ID */
  clipPathId: string
  /** 内部宽度 */
  innerWidth: number
  /** 是否显示 tooltip */
  showTooltip: boolean
  /** 是否可缩放 */
  zoomable: boolean
  /** 显示模式 */
  displayMode: WaveformDisplayMode
  /** 当前工具模式 */
  interactionMode?: WaveformInteractionMode
  /** 帧编号 */
  frameNumber?: string | number
  /** 图框样式 */
  frameStyle?: WaveformFrameStyle
  /** 时间单位 */
  timeUnit: 's' | 'ms'
  /** 悬浮点（用于显示十字线） */
  hoveredPoint?: HoveredSeriesPoint
  /** Y 轴标签回退值 */
  yLabel?: string
  /** Hide visual aids while keeping chart interaction active. */
  cleanView?: boolean
  /** Resolved zero reference line style. */
  zeroLine?: Required<Pick<WaveformZeroLineOptions, 'color' | 'width' | 'dash'>> & {
    visible: boolean
  }
}

interface Emits {
  (e: 'pointer-move', event: PointerEvent): void
  (e: 'pointer-down', event: PointerEvent): void
  (e: 'pointer-up', event: PointerEvent): void
  (e: 'pointer-cancel', event: PointerEvent): void
  (e: 'pointer-leave'): void
  (e: 'click', event: MouseEvent): void
  (e: 'contextmenu', event: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  interactionMode: 'zoom',
  cleanView: false,
  zeroLine: () => ({ visible: false, color: '#98a2b3', width: 1, dash: '6 4' }),
})
const emit = defineEmits<Emits>()

const xAxisElement = ref<SVGGElement>()
const yAxisElements = ref<SVGGElement[]>([])
const resolvedFrameStyle = computed(() => {
  const borderWidth = props.frameStyle?.borderWidth
  return {
    borderColor: props.frameStyle?.borderColor || '#1f2937',
    borderWidth:
      typeof borderWidth === 'number' && Number.isFinite(borderWidth) && borderWidth >= 0
        ? borderWidth
        : 1,
    borderStyle: props.frameStyle?.borderStyle === 'dashed' ? 'dashed' : 'solid',
    backgroundColor: props.frameStyle?.backgroundColor || 'transparent',
  }
})

function resolveYAxisLabel(series: DisplaySeries): string {
  return series.name.trim() || props.yLabel || ''
}

function hasYAxisTitle(axis: WaveformYAxisLayout): boolean {
  const series = axis.seriesList[0]
  return Boolean(series && resolveYAxisLabel(series))
}

function setYAxisElement(element: unknown, index: number) {
  if (element) yAxisElements.value[index] = element as SVGGElement
}

/**
 * 判断是否应该显示 Y 轴标签
 * 在紧凑模式下，当轨道高度太小时隐藏标签避免重叠
 */
function shouldShowYAxisLabel(trackHeight: number, trackIndex: number): boolean {
  const MIN_HEIGHT_FOR_LABEL = 80

  if (trackHeight >= MIN_HEIGHT_FOR_LABEL) {
    return true
  }

  const labelSpacing = Math.ceil(MIN_HEIGHT_FOR_LABEL / trackHeight)
  return trackIndex % labelSpacing === 0
}

function crosshairX(): number {
  return props.hoveredPoint && props.hoveredPoint.trackIndex === props.track.index
    ? props.track.xScale(props.hoveredPoint.point.x)
    : 0
}

function hasCrosshair(): boolean {
  return (
    props.showTooltip &&
    props.hoveredPoint !== undefined &&
    props.hoveredPoint.trackIndex === props.track.index
  )
}

function zeroLineY(axis: WaveformYAxisLayout): number | null {
  const [minimum, maximum] = axis.scale.domain()
  if (!props.zeroLine.visible || minimum > 0 || maximum < 0) return null
  return axis.scale(0)
}

function renderAxes() {
  props.track.yAxes.forEach((axis, index) => {
    const element = yAxisElements.value[index]
    if (!element) return
    const [axisMin, axisMax] = axis.scale.domain()
    const yAxis = (axis.side === 'left' ? axisLeft(axis.scale) : axisRight(axis.scale))
      .tickFormat((value) => formatScientificAxisLabel(Number(value), { axisMin, axisMax }))
      .tickSize(-4)
      .tickPadding(7)
      .tickSizeOuter(0)

    yAxis.tickValues(axis.tickValues)

    select(element).call(yAxis)
  })

  if (xAxisElement.value) {
    select(xAxisElement.value).call(
      axisBottom(props.track.xScale)
        .tickValues(props.track.xAxisTickValues)
        .tickFormat((value) =>
          formatAxisTime(
            Number(value),
            props.timeUnit,
            props.track.xScale.domain() as [number, number],
          ),
        )
        .tickSize(-4)
        .tickPadding(7)
        .tickSizeOuter(0),
    )
  }
}

onMounted(async () => {
  await nextTick()
  renderAxes()
})

watch(
  [
    () => props.track.xScale,
    () => props.track.yAxes,
    () => props.track.xAxisTickValues,
    () => props.track.yAxisTickValues,
    () => props.timeUnit,
  ],
  async () => {
    await nextTick()
    renderAxes()
  },
  { flush: 'post' },
)
</script>

<template>
  <g
    class="waveform-track waveform-chart__track"
    :class="{ 'waveform-track--empty waveform-chart__track--empty': track.isEmpty }"
    :data-track-index="track.index"
    :data-track-empty="track.isEmpty || undefined"
    :data-track-left="track.left"
    :data-track-width="track.width"
    :data-y-axis-label-x="track.yAxisLabelX"
    :data-track-top="track.top"
    :data-track-height="track.height"
    :transform="`translate(${track.left ?? 0}, ${track.top})`"
  >
    <rect
      v-if="!track.isEmpty && !cleanView"
      class="waveform-track__plot-background waveform-chart__plot-background"
      :width="track.width ?? innerWidth"
      :height="track.height"
      :fill="resolvedFrameStyle.backgroundColor"
      aria-hidden="true"
    />

    <!-- 网格和背景 -->
    <g
      v-if="!track.isEmpty && track.hasVisibleSeries && !cleanView"
      :clip-path="`url(#${clipPathId}-${track.index})`"
      aria-hidden="true"
    >
      <g
        class="waveform-track__grid waveform-track__grid--minor waveform-chart__grid waveform-chart__grid--minor"
      >
        <template v-if="track.gridLines.vertical">
          <line
            v-for="tick in track.xMinorTicks"
            :key="`x-minor-${track.index}-${tick}`"
            data-grid-direction="vertical"
            :x1="track.xScale(tick)"
            :x2="track.xScale(tick)"
            y1="0"
            :y2="track.height"
          />
        </template>
        <template v-if="track.gridLines.horizontal">
          <line
            v-for="tick in track.yMinorTicks"
            :key="`y-minor-${track.index}-${tick}`"
            data-grid-direction="horizontal"
            x1="0"
            :x2="track.width ?? innerWidth"
            :y1="track.yScale(tick)"
            :y2="track.yScale(tick)"
          />
        </template>
      </g>
      <g
        class="waveform-track__grid waveform-track__grid--major waveform-chart__grid waveform-chart__grid--major"
      >
        <template v-if="track.gridLines.vertical">
          <line
            v-for="tick in track.xMajorTicks"
            :key="`x-major-${track.index}-${tick}`"
            data-grid-direction="vertical"
            :x1="track.xScale(tick)"
            :x2="track.xScale(tick)"
            y1="0"
            :y2="track.height"
          />
        </template>
        <template v-if="track.gridLines.horizontal">
          <line
            v-for="tick in track.yMajorTicks"
            :key="`y-major-${track.index}-${tick}`"
            data-grid-direction="horizontal"
            x1="0"
            :x2="track.width ?? innerWidth"
            :y1="track.yScale(tick)"
            :y2="track.yScale(tick)"
          />
        </template>
      </g>
    </g>

    <g
      v-if="!track.isEmpty && track.hasVisibleSeries && zeroLine.visible && !cleanView"
      class="waveform-track__zero-lines waveform-chart__zero-lines"
      :clip-path="`url(#${clipPathId}-${track.index})`"
      aria-hidden="true"
    >
      <template v-for="axis in track.yAxes" :key="`zero-line-${track.index}-${axis.index}`">
        <line
          v-if="zeroLineY(axis) !== null"
          class="waveform-track__zero-line waveform-chart__zero-line"
          :data-y-axis-index="axis.index"
          x1="0"
          :x2="track.width ?? innerWidth"
          :y1="zeroLineY(axis) ?? 0"
          :y2="zeroLineY(axis) ?? 0"
          :stroke="zeroLine.color"
          :stroke-width="zeroLine.width"
          :stroke-dasharray="zeroLine.dash || undefined"
        />
      </template>
    </g>

    <!-- 帧编号水印 -->
    <text
      v-if="!track.isEmpty && track.hasVisibleSeries && frameNumber !== undefined && !cleanView"
      class="waveform-track__watermark waveform-chart__watermark"
      :x="(track.width ?? innerWidth) / 2"
      :y="track.height / 2"
      :style="{ fontSize: `${Math.min(120, track.height * 0.65)}px` }"
      text-anchor="middle"
      dominant-baseline="central"
      aria-hidden="true"
    >
      {{ frameNumber }}
    </text>

    <!-- X 轴 -->
    <g
      v-if="track.showXAxis && !cleanView"
      ref="xAxisElement"
      class="waveform-track__axis waveform-track__axis--x waveform-chart__axis waveform-chart__axis--x"
      :transform="`translate(0, ${track.height})`"
    />
    <g
      v-if="track.showXAxis && !cleanView"
      class="waveform-track__axis-endpoints waveform-chart__axis-endpoints"
      :transform="`translate(0, ${track.height})`"
      font-family="sans-serif"
      font-size="10"
      aria-hidden="true"
    >
      <text
        class="waveform-track__axis-endpoint waveform-track__axis-endpoint--start waveform-chart__axis-endpoint waveform-chart__axis-endpoint--start"
        x="0"
        y="7"
        dy="0.71em"
        text-anchor="start"
      >
        {{ track.endpointLabels.start }}
      </text>
      <text
        class="waveform-track__axis-endpoint waveform-track__axis-endpoint--end waveform-chart__axis-endpoint waveform-chart__axis-endpoint--end"
        :x="track.width ?? innerWidth"
        y="7"
        dy="0.71em"
        text-anchor="end"
      >
        {{ track.endpointLabels.end }}
      </text>
    </g>
    <text
      v-if="track.showXAxis && track.xAxisExponent && !cleanView"
      class="waveform-track__axis-exponent waveform-track__axis-exponent--x waveform-chart__axis-exponent waveform-chart__axis-exponent--x"
      :x="track.width ?? innerWidth"
      :y="track.height + 27"
      text-anchor="end"
      aria-hidden="true"
    >
      {{ track.xAxisExponent }}
    </text>

    <!-- Y 轴 -->
    <g
      v-for="axis in track.isEmpty || cleanView ? [] : track.yAxes"
      :key="`y-axis-${track.index}-${axis.index}`"
      :ref="(element) => setYAxisElement(element, axis.index)"
      class="waveform-track__axis waveform-track__axis--y waveform-chart__axis waveform-chart__axis--y"
      :class="`waveform-track__axis--${axis.side}`"
      :data-y-axis-index="axis.index"
      :data-y-axis-side="axis.side"
      :transform="`translate(${axis.x}, 0)`"
    />
    <text
      v-for="axis in track.isEmpty || cleanView
        ? []
        : track.yAxes.filter((item) => item.exponentLabel)"
      :key="`y-axis-exponent-${track.index}-${axis.index}`"
      class="waveform-track__axis-exponent waveform-track__axis-exponent--y waveform-chart__axis-exponent waveform-chart__axis-exponent--y"
      :data-y-axis-index="axis.index"
      :x="axis.exponentX"
      y="0"
      dy="0.32em"
      :text-anchor="axis.side === 'left' ? 'end' : 'start'"
      aria-hidden="true"
    >
      {{ axis.exponentLabel }}
    </text>

    <!-- Y 轴标签 -->
    <g
      v-if="
        !cleanView &&
        !track.isEmpty &&
        track.hasVisibleSeries &&
        track.seriesList.length === 1 &&
        track.showYAxisLabel &&
        resolveYAxisLabel(track.series) &&
        shouldShowYAxisLabel(track.height, track.index)
      "
    >
      <rect
        class="waveform-track__y-axis-label-bg waveform-chart__y-axis-label-bg"
        :x="track.yAxisLabelX - 12"
        :y="track.height / 2 - 40"
        width="24"
        height="80"
        rx="2"
      />
      <text
        class="waveform-track__y-axis-label waveform-chart__y-axis-label"
        :fill="track.series.color"
        :transform="`translate(${track.yAxisLabelX}, ${track.height / 2}) rotate(-90)`"
        text-anchor="middle"
        dominant-baseline="central"
      >
        {{ resolveYAxisLabel(track.series) }}
      </text>
    </g>

    <g
      v-for="axis in !cleanView && track.yAxes.length > 1 ? track.yAxes.filter(hasYAxisTitle) : []"
      :key="`y-axis-title-${track.index}-${axis.index}`"
      class="waveform-track__multi-axis-title"
      :data-y-axis-title-index="axis.index"
    >
      <rect
        class="waveform-track__y-axis-label-bg waveform-chart__y-axis-label-bg"
        :x="axis.labelX - 12"
        :y="track.height / 2 - 40"
        width="24"
        height="80"
        rx="2"
      />
      <text
        class="waveform-track__y-axis-label waveform-chart__y-axis-label"
        :fill="axis.seriesList[0].color"
        :transform="`translate(${axis.labelX}, ${track.height / 2}) rotate(-90)`"
        text-anchor="middle"
        dominant-baseline="central"
      >
        {{ resolveYAxisLabel(axis.seriesList[0]) }}
      </text>
    </g>

    <!-- 轨道边框 -->
    <rect
      v-if="!track.isEmpty && !cleanView"
      class="waveform-track__plot-frame waveform-chart__plot-frame"
      :width="track.width ?? innerWidth"
      :height="track.height"
      fill="none"
      :stroke="resolvedFrameStyle.borderColor"
      :stroke-width="resolvedFrameStyle.borderWidth"
      :stroke-dasharray="resolvedFrameStyle.borderStyle === 'dashed' ? '6 4' : undefined"
      aria-hidden="true"
    />

    <!-- 波形系列隔离在静态子组件中，避免 hover 更新遍历大量 SVG 节点。 -->
    <WaveformSeriesLayer :track="track" :clip-path-id="clipPathId" />

    <!-- 十字线 -->
    <g
      v-if="!track.isEmpty && track.hasVisibleSeries && hasCrosshair()"
      class="waveform-track__crosshair waveform-chart__crosshair"
      :clip-path="`url(#${clipPathId}-${track.index})`"
    >
      <line :x1="crosshairX()" :x2="crosshairX()" y1="0" :y2="track.height" />
    </g>

    <!-- 交互覆盖层（仅在独立模式下） -->
    <rect
      v-if="!track.isEmpty && track.hasVisibleSeries && displayMode === 'independent'"
      class="waveform-track__overlay waveform-track__overlay--independent waveform-chart__overlay waveform-chart__overlay--independent"
      :class="{
        'is-zoomable': zoomable && interactionMode === 'zoom',
        'is-annotating': interactionMode === 'annotation',
      }"
      :data-independent-overlay-index="track.index"
      :width="track.width ?? innerWidth"
      :height="track.height"
      @pointermove="emit('pointer-move', $event)"
      @pointerdown="emit('pointer-down', $event)"
      @pointerup="emit('pointer-up', $event)"
      @pointercancel="emit('pointer-cancel', $event)"
      @pointerleave="emit('pointer-leave')"
      @click="emit('click', $event)"
      @contextmenu="emit('contextmenu', $event)"
    />

    <text
      v-if="!track.isEmpty && !track.hasVisibleSeries && !cleanView"
      class="waveform-track__no-visible-series"
      :x="(track.width ?? innerWidth) / 2"
      :y="track.height / 2"
      text-anchor="middle"
      dominant-baseline="central"
    >
      暂无可见曲线
    </text>
  </g>
</template>

<style scoped>
.waveform-track {
  isolation: isolate;
  pointer-events: none;
}

.waveform-track__y-axis-label-bg {
  fill: white;
  opacity: 0.9;
  pointer-events: none;
}

.waveform-track__y-axis-label {
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
}

.waveform-track__grid {
  pointer-events: none;
}

.waveform-track__grid--major line {
  stroke: #dfe5ef;
  stroke-width: 1;
}

.waveform-track__grid--minor line {
  stroke: #f2f5fa;
  stroke-width: 1;
}

.waveform-track__plot-frame {
  pointer-events: none;
}

.waveform-track__plot-background {
  pointer-events: none;
}

.waveform-track__watermark {
  fill: rgb(22 119 255 / 10%);
  font-family: Consolas, Monaco, 'Courier New', monospace;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

.waveform-track__overlay {
  fill: transparent;
  cursor: crosshair;
  pointer-events: all;
  touch-action: none;
}

.waveform-track__no-visible-series {
  fill: #8c8c8c;
  font: 13px sans-serif;
  pointer-events: none;
}

.waveform-track__overlay.is-zoomable {
  cursor: grab;
}

.waveform-track__overlay.is-zoomable:active {
  cursor: grabbing;
}

.waveform-track__overlay.is-annotating {
  cursor: crosshair;
}

.waveform-track__crosshair {
  pointer-events: none;
}

.waveform-track__crosshair line {
  stroke: #57617b;
  stroke-width: 1;
  stroke-dasharray: 4 3;
}

.waveform-track__zero-line {
  fill: none;
  pointer-events: none;
}

.waveform-track__axis-endpoint {
  fill: #667085;
  font-size: 11px;
  pointer-events: none;
}

.waveform-track__axis-exponent {
  fill: #666;
  font-family: sans-serif;
  font-size: 10px;
}

:deep(.waveform-track__axis path),
:deep(.waveform-track__axis line) {
  stroke: #1f2937;
}

:deep(.waveform-track__axis text) {
  fill: #667085;
  font-size: 11px;
}
</style>

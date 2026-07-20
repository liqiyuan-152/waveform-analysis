<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { axisBottom, axisLeft, select } from 'd3'
import { formatAxisTime, formatScientificYAxisLabel } from '../../utils'
import type { WaveformDisplayMode, WaveformInteractionMode } from '../data/types'
import type { DisplaySeries, HoveredSeriesPoint, TrackLayout } from '../core/types'

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
  /** 时间单位 */
  timeUnit: 's' | 'ms'
  /** 悬浮点（用于显示十字线） */
  hoveredPoint?: HoveredSeriesPoint
  /** Y 轴标签回退值 */
  yLabel?: string
}

interface Emits {
  (e: 'pointer-move', event: PointerEvent): void
  (e: 'pointer-leave'): void
  (e: 'click', event: MouseEvent): void
  (e: 'contextmenu', event: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  interactionMode: 'zoom',
})
const emit = defineEmits<Emits>()

const xAxisElement = ref<SVGGElement>()
const yAxisElement = ref<SVGGElement>()

function resolveYAxisLabel(series: DisplaySeries): string {
  return series.name.trim() || props.yLabel || ''
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

function crosshairY(): number {
  return props.hoveredPoint && props.hoveredPoint.trackIndex === props.track.index
    ? props.track.yScale(props.hoveredPoint.point.y)
    : 0
}

function hasCrosshair(): boolean {
  return (
    props.showTooltip &&
    props.hoveredPoint !== undefined &&
    props.hoveredPoint.trackIndex === props.track.index
  )
}

function renderAxes() {
  if (yAxisElement.value) {
    const [axisMin, axisMax] = props.track.yScale.domain()
    const visibleTicks = props.track.yAxisTickValues ?? props.track.yMajorTicks
    const topTickValue = visibleTicks.reduce<number | undefined>((closestTick, tickValue) => {
      if (closestTick === undefined) return tickValue
      return Math.abs(tickValue - axisMax) < Math.abs(closestTick - axisMax)
        ? tickValue
        : closestTick
    }, undefined)
    const yAxis = axisLeft(props.track.yScale)
      .tickFormat((value) =>
        formatScientificYAxisLabel(Number(value), { axisMin, axisMax, topTickValue }),
      )
      .tickSize(-4)
      .tickPadding(7)
      .tickSizeOuter(0)

    if (props.track.yAxisTickValues) {
      yAxis.tickValues(props.track.yAxisTickValues)
    }

    select(yAxisElement.value).call(yAxis)
  }

  if (xAxisElement.value) {
    select(xAxisElement.value).call(
      axisBottom(props.track.xScale)
        .tickValues(props.track.xAxisTickValues)
        .tickFormat((value) => formatAxisTime(Number(value), props.timeUnit))
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
    () => props.track.yScale,
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
    :data-track-index="track.index"
    :data-track-left="track.left"
    :data-track-width="track.width"
    :data-y-axis-label-x="track.yAxisLabelX"
    :data-track-top="track.top"
    :data-track-height="track.height"
    :transform="`translate(${track.left ?? 0}, ${track.top})`"
  >
    <!-- 网格和背景 -->
    <g :clip-path="`url(#${clipPathId}-${track.index})`" aria-hidden="true">
      <g
        class="waveform-track__grid waveform-track__grid--minor waveform-chart__grid waveform-chart__grid--minor"
      >
        <line
          v-for="tick in track.xMinorTicks"
          :key="`x-minor-${track.index}-${tick}`"
          :x1="track.xScale(tick)"
          :x2="track.xScale(tick)"
          y1="0"
          :y2="track.height"
        />
        <line
          v-for="tick in track.yMinorTicks"
          :key="`y-minor-${track.index}-${tick}`"
          x1="0"
          :x2="track.width ?? innerWidth"
          :y1="track.yScale(tick)"
          :y2="track.yScale(tick)"
        />
      </g>
      <g
        class="waveform-track__grid waveform-track__grid--major waveform-chart__grid waveform-chart__grid--major"
      >
        <line
          v-for="tick in track.xMajorTicks"
          :key="`x-major-${track.index}-${tick}`"
          :x1="track.xScale(tick)"
          :x2="track.xScale(tick)"
          y1="0"
          :y2="track.height"
        />
        <line
          v-for="tick in track.yMajorTicks"
          :key="`y-major-${track.index}-${tick}`"
          x1="0"
          :x2="track.width ?? innerWidth"
          :y1="track.yScale(tick)"
          :y2="track.yScale(tick)"
        />
      </g>
    </g>

    <!-- 帧编号水印 -->
    <text
      v-if="frameNumber !== undefined"
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
      v-if="track.showXAxis"
      ref="xAxisElement"
      class="waveform-track__axis waveform-track__axis--x waveform-chart__axis waveform-chart__axis--x"
      :transform="`translate(0, ${track.height})`"
    />
    <g
      v-if="track.showXAxis"
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

    <!-- Y 轴 -->
    <g
      ref="yAxisElement"
      class="waveform-track__axis waveform-track__axis--y waveform-chart__axis waveform-chart__axis--y"
    />

    <!-- Y 轴标签 -->
    <g
      v-if="
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

    <!-- 轨道边框 -->
    <rect
      class="waveform-track__plot-frame waveform-chart__plot-frame"
      :width="track.width ?? innerWidth"
      :height="track.height"
      aria-hidden="true"
    />

    <!-- 波形线 -->
    <path
      class="waveform-track__line waveform-chart__line"
      :data-series-id="track.series.id"
      :data-series-name="track.series.name || undefined"
      :d="track.path ?? undefined"
      :stroke="track.series.color"
      :clip-path="`url(#${clipPathId}-${track.index})`"
    />

    <!-- 十字线 -->
    <g
      v-if="hasCrosshair()"
      class="waveform-track__crosshair waveform-chart__crosshair"
      :clip-path="`url(#${clipPathId}-${track.index})`"
    >
      <line :x1="crosshairX()" :x2="crosshairX()" y1="0" :y2="track.height" />
      <line x1="0" :x2="track.width ?? innerWidth" :y1="crosshairY()" :y2="crosshairY()" />
      <circle :cx="crosshairX()" :cy="crosshairY()" r="4" :fill="track.series.color" />
    </g>

    <!-- 交互覆盖层（仅在独立模式下） -->
    <rect
      v-if="displayMode === 'independent'"
      class="waveform-track__overlay waveform-track__overlay--independent waveform-chart__overlay waveform-chart__overlay--independent"
      :class="{
        'is-zoomable': zoomable && interactionMode === 'zoom',
        'is-annotating': interactionMode === 'annotation',
      }"
      :data-independent-overlay-index="track.index"
      :width="track.width ?? innerWidth"
      :height="track.height"
      @pointermove="emit('pointer-move', $event)"
      @pointerleave="emit('pointer-leave')"
      @click="emit('click', $event)"
      @contextmenu="emit('contextmenu', $event)"
    />
  </g>
</template>

<style scoped>
.waveform-track {
  isolation: isolate;
}

.waveform-track__line {
  fill: none;
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
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
  fill: none;
  stroke: #1f2937;
  stroke-width: 1;
  pointer-events: none;
}

.waveform-track__watermark {
  fill: rgb(22 119 255 / 10%);
  font-family: Consolas, Monaco, 'Courier New', monospace;
  pointer-events: none;
}

.waveform-track__overlay {
  fill: transparent;
  cursor: crosshair;
  touch-action: none;
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

.waveform-track__crosshair circle {
  stroke: #fff;
  stroke-width: 2;
}

.waveform-track__axis-endpoint {
  fill: #667085;
  font-size: 11px;
  pointer-events: none;
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

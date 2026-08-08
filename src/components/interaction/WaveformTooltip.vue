<script setup lang="ts">
import { computed } from 'vue'
import { resolveWaveformPointErrors } from '../../core'
import { formatTooltipNumber, formatTooltipTime } from '../../utils'
import type { WaveformPoint } from '../data/types'

interface SeriesPoint {
  trackIndex: number
  name: string
  color: string
  unit?: string
  point: WaveformPoint
}

interface Props {
  /** 是否显示 */
  visible: boolean
  /** 鼠标位置 */
  position: { x: number; y: number }
  /** 时间单位 */
  timeUnit: 's' | 'ms'
  /** 悬浮的点 */
  hoveredPoint: WaveformPoint | null
  /** 所有系列的悬浮点 */
  seriesPoints: SeriesPoint[]
  /** 容器宽度 */
  containerWidth: number
  /** 容器高度 */
  containerHeight: number
}

const props = defineProps<Props>()

const tooltipGap = 12
const containerPadding = 8
const tooltipPlacementWidth = 238
const tooltipMaxWidth = 320
const tooltipHorizontalPadding = 20
const tooltipLineHeight = 20

function estimateLineCount(text: string, width: number): number {
  const contentWidth = Math.max(1, width - tooltipHorizontalPadding - 14)
  const charactersPerLine = Math.max(1, Math.floor(contentWidth / 7.2))
  return Math.max(1, Math.ceil([...text].length / charactersPerLine))
}

function formatSeriesText(seriesPoint: SeriesPoint): string {
  const error = formatError(seriesPoint.point)
  return `${seriesPoint.name ? `${seriesPoint.name}: ` : ''}${formatTooltipNumber(seriesPoint.point.y)}${
    seriesPoint.unit ? ` ${seriesPoint.unit}` : ''
  }${error ? ` ${error}` : ''}`
}

function estimateTooltipHeight(width: number, timeText: string): number {
  const seriesLines = props.seriesPoints.reduce(
    (total, seriesPoint) => total + estimateLineCount(formatSeriesText(seriesPoint), width),
    0,
  )
  return 16 + tooltipLineHeight * (estimateLineCount(timeText, width) + seriesLines) + 5
}

const tooltipStyle = computed(() => {
  if (!props.visible || !props.hoveredPoint) return { display: 'none' }

  const rightPlacement = props.position.x + tooltipGap
  const leftPlacement = props.position.x - tooltipGap - tooltipPlacementWidth
  const rightAvailableWidth = props.containerWidth - containerPadding - rightPlacement
  const leftAvailableWidth = props.position.x - tooltipGap - containerPadding
  const availableWidth = Math.max(
    1,
    Math.min(tooltipMaxWidth, props.containerWidth - containerPadding * 2),
  )
  const horizontalStyle =
    rightPlacement + tooltipPlacementWidth <= props.containerWidth - containerPadding
      ? {
          left: `${rightPlacement}px`,
          maxWidth: `${Math.min(tooltipMaxWidth, rightAvailableWidth)}px`,
        }
      : leftPlacement >= containerPadding
        ? {
            right: `${props.containerWidth - props.position.x + tooltipGap}px`,
            maxWidth: `${Math.min(tooltipMaxWidth, leftAvailableWidth)}px`,
          }
        : { left: `${containerPadding}px`, maxWidth: `${availableWidth}px` }

  const maxWidth = Number.parseFloat(horizontalStyle.maxWidth)
  const timeText = `${props.timeUnit}: ${formatTooltipTime(props.hoveredPoint.x, props.timeUnit)}`

  return {
    ...horizontalStyle,
    top: `${Math.max(
      8,
      Math.min(
        props.position.y - 18,
        props.containerHeight - estimateTooltipHeight(maxWidth, timeText) - 8,
      ),
    )}px`,
  }
})

function formatError(point: WaveformPoint): string | null {
  const { lower, upper } = resolveWaveformPointErrors(point)
  if (lower === 0 && upper === 0) return null
  return `(+${formatTooltipNumber(upper)} / -${formatTooltipNumber(lower)})`
}
</script>

<template>
  <div
    v-if="visible && hoveredPoint"
    class="waveform-tooltip waveform-chart__tooltip"
    :style="tooltipStyle"
  >
    <span class="waveform-tooltip__time waveform-chart__tooltip-time">
      {{ timeUnit }}: {{ formatTooltipTime(hoveredPoint.x, timeUnit) }}
    </span>
    <span
      v-for="seriesPoint in seriesPoints"
      :key="`${seriesPoint.trackIndex}-${seriesPoint.name}`"
      class="waveform-tooltip__series waveform-chart__tooltip-series"
    >
      <i :style="{ backgroundColor: seriesPoint.color }" />
      <span class="waveform-tooltip__series-content">
        <strong v-if="seriesPoint.name">{{ seriesPoint.name }}:</strong>
        <span class="waveform-tooltip__value">
          {{ formatTooltipNumber(seriesPoint.point.y)
          }}{{ seriesPoint.unit ? ` ${seriesPoint.unit}` : '' }}
          <small v-if="formatError(seriesPoint.point)">{{ formatError(seriesPoint.point) }}</small>
        </span>
      </span>
    </span>
  </div>
</template>

<style scoped>
.waveform-tooltip {
  box-sizing: border-box;
  position: absolute;
  z-index: 2;
  display: grid;
  gap: 3px;
  width: max-content;
  max-width: min(320px, calc(100% - 16px));
  padding: 8px 10px;
  color: #333;
  font:
    12px/1.45 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
  pointer-events: none;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  box-shadow: 0 4px 12px rgb(16 24 40 / 12%);
}

.waveform-tooltip__time {
  padding-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
}

.waveform-tooltip__series {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr);
  gap: 6px;
  align-items: start;
}

.waveform-tooltip__series i {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 4px;
  border-radius: 50%;
}

.waveform-tooltip__series-content {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.waveform-tooltip__series strong {
  font-weight: 600;
}

.waveform-tooltip__value {
  overflow-wrap: anywhere;
}

.waveform-tooltip__series small {
  color: #667085;
}
</style>

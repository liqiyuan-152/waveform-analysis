<script setup lang="ts">
import { computed } from 'vue'
import { formatTooltipNumber, formatTooltipTime } from '../../utils'
import type { WaveformPoint } from '../data/types'

interface SeriesPoint {
  trackIndex: number
  name: string
  shotNo?: string
  color: string
  unit?: string
  point: WaveformPoint | null
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
const tooltipMaxWidth = 560
const tooltipHorizontalPadding = 20
const tooltipLineHeight = 20

function estimateLineCount(text: string, width: number): number {
  const contentWidth = Math.max(1, width - tooltipHorizontalPadding - 14)
  const charactersPerLine = Math.max(1, Math.floor(contentWidth / 7.2))
  return Math.max(1, Math.ceil([...text].length / charactersPerLine))
}

function formatSeriesText(seriesPoint: SeriesPoint): string {
  const valueText = seriesPoint.point
    ? `(x:${formatTooltipTime(seriesPoint.point.x, props.timeUnit)} y:${formatTooltipNumber(seriesPoint.point.y)})`
    : '无数据'
  return `${seriesPoint.shotNo?.trim() || '未配置炮号'}： ${seriesPoint.name}${
    seriesPoint.unit ? `(${seriesPoint.unit})` : ''
  }  ${valueText}`
}

function estimateTooltipHeight(width: number): number {
  const seriesLines = props.seriesPoints.reduce(
    (total, seriesPoint) => total + estimateLineCount(formatSeriesText(seriesPoint), width),
    0,
  )
  return 16 + tooltipLineHeight * seriesLines + 5
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
  return {
    ...horizontalStyle,
    top: `${Math.max(
      8,
      Math.min(props.position.y - 18, props.containerHeight - estimateTooltipHeight(maxWidth) - 8),
    )}px`,
  }
})
</script>

<template>
  <div
    v-if="visible && hoveredPoint"
    class="waveform-tooltip waveform-chart__tooltip"
    :style="tooltipStyle"
  >
    <span
      v-for="seriesPoint in seriesPoints"
      :key="`${seriesPoint.trackIndex}-${seriesPoint.name}`"
      class="waveform-tooltip__series waveform-chart__tooltip-series"
    >
      <i :style="{ backgroundColor: seriesPoint.color }" />
      <span class="waveform-tooltip__series-content">
        <span class="waveform-tooltip__series-label"
          >{{ seriesPoint.shotNo?.trim() || '未配置炮号' }}： {{ seriesPoint.name
          }}<template v-if="seriesPoint.unit">({{ seriesPoint.unit }})</template></span
        >
        <span v-if="seriesPoint.point" class="waveform-tooltip__value"
          >(x:{{ formatTooltipTime(seriesPoint.point.x, timeUnit) }} y:{{
            formatTooltipNumber(seriesPoint.point.y)
          }})</span
        >
        <span v-else class="waveform-tooltip__value waveform-tooltip__value--missing">无数据</span>
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
  gap: 2px;
  width: max-content;
  max-width: min(560px, calc(100% - 16px));
  padding: 9px 12px;
  color: #505050;
  font:
    14px/1.35 Arial,
    sans-serif;
  pointer-events: none;
  background: #fff;
  border: 1px solid #e3e7eb;
  border-radius: 4px;
  box-shadow: 0 3px 10px rgb(16 24 40 / 15%);
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
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  align-items: baseline;
  min-width: 0;
}

.waveform-tooltip__series-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waveform-tooltip__value {
  flex: 0 0 auto;
  white-space: nowrap;
}

.waveform-tooltip__series strong {
  font-weight: 600;
}

.waveform-tooltip__value {
  color: #555;
}

.waveform-tooltip__series small {
  color: #667085;
}
</style>

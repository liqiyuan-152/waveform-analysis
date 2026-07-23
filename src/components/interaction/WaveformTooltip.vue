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
const tooltipMaxWidth = 238

const tooltipStyle = computed(() => {
  if (!props.visible || !props.hoveredPoint) return { display: 'none' }

  const estimatedHeight = 44 + props.seriesPoints.length * 22
  const rightPlacement = props.position.x + tooltipGap
  const leftPlacement = props.position.x - tooltipGap - tooltipMaxWidth
  const horizontalStyle =
    rightPlacement + tooltipMaxWidth <= props.containerWidth - containerPadding
      ? { left: `${rightPlacement}px` }
      : leftPlacement >= containerPadding
        ? { right: `${props.containerWidth - props.position.x + tooltipGap}px` }
        : { left: `${containerPadding}px` }

  return {
    ...horizontalStyle,
    top: `${Math.max(8, Math.min(props.position.y - 18, props.containerHeight - estimatedHeight - 8))}px`,
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
      <strong v-if="seriesPoint.name">{{ seriesPoint.name }}:</strong>
      <span class="waveform-tooltip__value">
        {{ formatTooltipNumber(seriesPoint.point.y)
        }}{{ seriesPoint.unit ? ` ${seriesPoint.unit}` : '' }}
        <small v-if="formatError(seriesPoint.point)">{{ formatError(seriesPoint.point) }}</small>
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
  min-width: 180px;
  max-width: 238px;
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
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.waveform-tooltip__series i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.waveform-tooltip__series strong {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waveform-tooltip__value {
  white-space: nowrap;
}

.waveform-tooltip__series small {
  color: #667085;
  white-space: nowrap;
}
</style>

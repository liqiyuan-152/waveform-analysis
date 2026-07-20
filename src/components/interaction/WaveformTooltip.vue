<script setup lang="ts">
import { computed } from 'vue'
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

const tooltipStyle = computed(() => {
  if (!props.visible || !props.hoveredPoint) return { display: 'none' }

  const estimatedHeight = 44 + props.seriesPoints.length * 22
  return {
    left: `${Math.min(props.position.x + 12, Math.max(8, props.containerWidth - 250))}px`,
    top: `${Math.max(8, Math.min(props.position.y - 18, props.containerHeight - estimatedHeight - 8))}px`,
  }
})
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
      <span>
        {{ formatTooltipNumber(seriesPoint.point.y)
        }}{{ seriesPoint.unit ? ` ${seriesPoint.unit}` : '' }}
      </span>
    </span>
  </div>
</template>

<style scoped>
.waveform-tooltip {
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
  grid-template-columns: 8px auto minmax(0, 1fr);
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
</style>

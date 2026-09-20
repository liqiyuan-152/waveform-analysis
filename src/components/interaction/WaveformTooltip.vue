<script setup lang="ts">
import { computed, onUpdated, ref, watch } from 'vue'
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
const tooltipMaxWidth = 560
const tooltipElement = ref<HTMLElement | null>(null)
const tooltipSize = ref({ width: 0, height: 0 })

function measureTooltip() {
  const bounds = tooltipElement.value?.getBoundingClientRect()
  const width = bounds?.width ?? 0
  const height = bounds?.height ?? 0
  if (width !== tooltipSize.value.width || height !== tooltipSize.value.height) {
    tooltipSize.value = { width, height }
  }
}

// The width cap depends only on the container, never on the cursor's side.
// Measuring the rendered box therefore cannot cause a shrink/flip feedback loop.
watch(
  tooltipElement,
  (element, _, onCleanup) => {
    measureTooltip()
    if (!element) return
    const observer = new ResizeObserver(measureTooltip)
    observer.observe(element)
    onCleanup(() => observer.disconnect())
  },
  { flush: 'post' },
)
onUpdated(measureTooltip)

const tooltipStyle = computed(() => {
  if (!props.visible || !props.hoveredPoint) return { display: 'none' }

  const rightPlacement = props.position.x + tooltipGap
  const leftPlacement = props.position.x - tooltipGap - tooltipSize.value.width
  const availableWidth = Math.max(
    1,
    Math.min(tooltipMaxWidth, props.containerWidth - containerPadding * 2),
  )
  const horizontalStyle =
    rightPlacement + tooltipSize.value.width <= props.containerWidth - containerPadding
      ? { left: `${rightPlacement}px` }
      : leftPlacement >= containerPadding
        ? { right: `${props.containerWidth - props.position.x + tooltipGap}px` }
        : { left: `${containerPadding}px` }

  return {
    ...horizontalStyle,
    maxWidth: `${availableWidth}px`,
    visibility: tooltipSize.value.width > 0 ? ('visible' as const) : ('hidden' as const),
    top: `${Math.max(
      containerPadding,
      Math.min(
        props.position.y - 18,
        props.containerHeight - tooltipSize.value.height - containerPadding,
      ),
    )}px`,
  }
})
</script>

<template>
  <div
    v-if="visible && hoveredPoint"
    ref="tooltipElement"
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
  flex-wrap: wrap;
  gap: 12px;
  align-items: baseline;
  min-width: 0;
}

.waveform-tooltip__series-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.waveform-tooltip__value {
  flex: 0 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
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

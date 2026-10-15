<script setup lang="ts">
import { computed, onUpdated, ref, watch } from 'vue'
import { formatTooltipNumber, formatTooltipTime } from '@/utils/index'
import type { WaveformPoint } from '@/components/data/types'
import { tooltipPlacement } from '@/view/tooltipPlacement'

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

  return tooltipPlacement(props.position, tooltipSize.value, {
    width: props.containerWidth,
    height: props.containerHeight,
  })
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

<style src="../../../../../src/styles/tooltip.css"></style>

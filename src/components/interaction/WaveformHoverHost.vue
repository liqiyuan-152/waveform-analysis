<script setup lang="ts">
import { computed } from 'vue'

import type { WaveformHoverState } from '../core/types'
import WaveformTooltip from './WaveformTooltip.vue'

const props = defineProps<{
  state: WaveformHoverState
  visible: boolean
  timeUnit: 's' | 'ms'
  containerWidth: number
  containerHeight: number
}>()

const hoveredPoint = computed(() => props.state.points[0]?.point ?? null)
</script>

<template>
  <WaveformTooltip
    :visible="visible && hoveredPoint !== null"
    :position="state.position"
    :time-unit="timeUnit"
    :hovered-point="hoveredPoint"
    :series-points="state.points"
    :container-width="containerWidth"
    :container-height="containerHeight"
  />
</template>

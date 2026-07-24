<script setup lang="ts">
import { computed } from 'vue'

import type { HoveredSeriesPoint, TrackLayout, WaveformHoverState } from '../core/types'

const props = defineProps<{
  state: WaveformHoverState
  tracks: TrackLayout[]
  clipPathId: string
  visible: boolean
}>()

interface Crosshair {
  point: HoveredSeriesPoint
  track: TrackLayout
  x: number
}

const crosshairs = computed<Crosshair[]>(() => {
  if (!props.visible) return []

  const pointByTrack = new Map<number, HoveredSeriesPoint>()
  props.state.points.forEach((point) => {
    if (!pointByTrack.has(point.trackIndex)) pointByTrack.set(point.trackIndex, point)
  })

  return props.tracks.flatMap((track) => {
    const point = pointByTrack.get(track.index)
    return point && !track.isEmpty && track.hasVisibleSeries
      ? [{ point, track, x: track.xScale(point.point.x) }]
      : []
  })
})
</script>

<template>
  <g class="waveform-chart__hover-layer" pointer-events="none" aria-hidden="true">
    <g
      v-for="crosshair in crosshairs"
      :key="crosshair.track.index"
      class="waveform-track__crosshair waveform-chart__crosshair"
      :clip-path="`url(#${clipPathId}-${crosshair.track.index})`"
      :transform="`translate(${crosshair.track.left ?? 0}, ${crosshair.track.top})`"
    >
      <line :x1="crosshair.x" :x2="crosshair.x" y1="0" :y2="crosshair.track.height" />
    </g>
  </g>
</template>

<style scoped>
.waveform-track__crosshair {
  pointer-events: none;
}

.waveform-track__crosshair line {
  stroke: #57617b;
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
</style>

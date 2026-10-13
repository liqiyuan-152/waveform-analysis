<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { updateGrid } from './updateGrid'
import type { TrackLayout } from '../core/types'

interface Props {
  track: TrackLayout
  clipPathId: string
  innerWidth: number
  cleanView: boolean
  showEmptyFrame?: boolean
  frameNumber?: string | number
  frameStyle: {
    backgroundColor: string
  }
}

const props = defineProps<Props>()
const minorVertical = ref<SVGGElement>()
const minorHorizontal = ref<SVGGElement>()
const majorVertical = ref<SVGGElement>()
const majorHorizontal = ref<SVGGElement>()
watchEffect(
  () => {
    const track = props.track
    for (const [element, direction, ticks] of [
      [minorVertical.value, 'vertical', track.xMinorTicks],
      [minorHorizontal.value, 'horizontal', track.yMinorTicks],
      [majorVertical.value, 'vertical', track.xMajorTicks],
      [majorHorizontal.value, 'horizontal', track.yMajorTicks],
    ] as const) {
      if (element)
        updateGrid(
          element,
          track.gridLines[direction] ? ticks : [],
          direction === 'vertical' ? track.xScale : track.yScale,
          direction,
          direction === 'vertical' ? track.height : (track.width ?? props.innerWidth),
          direction === 'vertical'
            ? track.gridLines.verticalColor
            : track.gridLines.horizontalColor,
        )
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <rect
    v-if="(!track.isEmpty || showEmptyFrame) && !cleanView"
    class="waveform-track__plot-background waveform-chart__plot-background"
    :width="track.width ?? innerWidth"
    :height="track.height"
    :fill="frameStyle.backgroundColor"
    aria-hidden="true"
  />

  <g
    v-if="(!track.isEmpty || showEmptyFrame) && !cleanView"
    :clip-path="`url(#${clipPathId}-${track.index})`"
    aria-hidden="true"
  >
    <g
      class="waveform-track__grid waveform-track__grid--minor waveform-chart__grid waveform-chart__grid--minor"
    >
      <g ref="minorVertical" />
      <g ref="minorHorizontal" />
    </g>
    <g
      class="waveform-track__grid waveform-track__grid--major waveform-chart__grid waveform-chart__grid--major"
    >
      <g ref="majorVertical" />
      <g ref="majorHorizontal" />
    </g>
  </g>

  <text
    v-if="
      (track.hasVisibleSeries || (track.isEmpty && showEmptyFrame)) &&
      frameNumber !== undefined &&
      !cleanView
    "
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
</template>

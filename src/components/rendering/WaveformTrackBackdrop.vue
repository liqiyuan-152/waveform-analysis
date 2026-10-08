<script setup lang="ts">
import type { TrackLayout } from '../core/types'

interface Props {
  track: TrackLayout
  clipPathId: string
  innerWidth: number
  cleanView: boolean
  frameNumber?: string | number
  frameStyle: {
    backgroundColor: string
  }
}

defineProps<Props>()
</script>

<template>
  <rect
    v-if="!track.isEmpty && !cleanView"
    class="waveform-track__plot-background waveform-chart__plot-background"
    :width="track.width ?? innerWidth"
    :height="track.height"
    :fill="frameStyle.backgroundColor"
    aria-hidden="true"
  />

  <g
    v-if="!track.isEmpty && track.hasVisibleSeries && !cleanView"
    :clip-path="`url(#${clipPathId}-${track.index})`"
    aria-hidden="true"
  >
    <g
      class="waveform-track__grid waveform-track__grid--minor waveform-chart__grid waveform-chart__grid--minor"
    >
      <template v-if="track.gridLines.vertical">
        <line
          v-for="tick in track.xMinorTicks"
          :key="`x-minor-${track.index}-${tick}`"
          data-grid-direction="vertical"
          :stroke="track.gridLines.verticalColor"
          :x1="track.xScale(tick)"
          :x2="track.xScale(tick)"
          y1="0"
          :y2="track.height"
        />
      </template>
      <template v-if="track.gridLines.horizontal">
        <line
          v-for="tick in track.yMinorTicks"
          :key="`y-minor-${track.index}-${tick}`"
          data-grid-direction="horizontal"
          :stroke="track.gridLines.horizontalColor"
          x1="0"
          :x2="track.width ?? innerWidth"
          :y1="track.yScale(tick)"
          :y2="track.yScale(tick)"
        />
      </template>
    </g>
    <g
      class="waveform-track__grid waveform-track__grid--major waveform-chart__grid waveform-chart__grid--major"
    >
      <template v-if="track.gridLines.vertical">
        <line
          v-for="tick in track.xMajorTicks"
          :key="`x-major-${track.index}-${tick}`"
          data-grid-direction="vertical"
          :stroke="track.gridLines.verticalColor"
          :x1="track.xScale(tick)"
          :x2="track.xScale(tick)"
          y1="0"
          :y2="track.height"
        />
      </template>
      <template v-if="track.gridLines.horizontal">
        <line
          v-for="tick in track.yMajorTicks"
          :key="`y-major-${track.index}-${tick}`"
          data-grid-direction="horizontal"
          :stroke="track.gridLines.horizontalColor"
          x1="0"
          :x2="track.width ?? innerWidth"
          :y1="track.yScale(tick)"
          :y2="track.yScale(tick)"
        />
      </template>
    </g>
  </g>

  <text
    v-if="!track.isEmpty && track.hasVisibleSeries && frameNumber !== undefined && !cleanView"
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

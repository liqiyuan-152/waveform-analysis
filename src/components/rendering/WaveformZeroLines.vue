<script setup lang="ts">
import type { WaveformZeroLineOptions } from '../../types'
import type { TrackLayout, WaveformYAxisLayout } from '../core/types'

const props = defineProps<{
  track: TrackLayout
  clipPathId: string
  innerWidth: number
  cleanView: boolean
  zeroLine: Required<WaveformZeroLineOptions>
}>()

function zeroLineY(axis: WaveformYAxisLayout): number | null {
  const [minimum, maximum] = axis.scale.domain()
  const tickInterval = Math.abs(axis.tickValues[1] - axis.tickValues[0])
  const margin = tickInterval * props.zeroLine.boundaryThreshold
  if (
    !props.zeroLine.visible ||
    minimum >= 0 ||
    maximum <= 0 ||
    -minimum < margin ||
    maximum < margin
  )
    return null
  return axis.scale(0)
}
</script>

<template>
  <g
    v-if="!track.isEmpty && track.hasVisibleSeries && zeroLine.visible && !cleanView"
    class="waveform-track__zero-lines waveform-chart__zero-lines"
    :clip-path="`url(#${clipPathId}-${track.index})`"
    aria-hidden="true"
    pointer-events="none"
  >
    <template v-for="axis in track.yAxes" :key="`zero-line-${track.index}-${axis.index}`">
      <line
        v-if="zeroLineY(axis) !== null"
        class="waveform-track__zero-line waveform-chart__zero-line"
        :data-y-axis-index="axis.index"
        x1="0"
        :x2="track.width ?? innerWidth"
        :y1="zeroLineY(axis) ?? 0"
        :y2="zeroLineY(axis) ?? 0"
        :stroke="zeroLine.color"
        :stroke-opacity="zeroLine.opacity"
        :stroke-width="zeroLine.width"
        :stroke-dasharray="zeroLine.dash || undefined"
      />
    </template>
  </g>
</template>

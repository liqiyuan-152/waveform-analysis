<script setup lang="ts">
import { computed } from 'vue'

import { resolveWaveformPointErrors } from '../../core'
import type { TrackLayout, TrackSeriesPath } from '../core/types'
import { waveformPointSeriesPath } from './seriesStyle'

const props = defineProps<{
  track: TrackLayout
  clipPathId: string
}>()

interface RenderedSeriesPath extends TrackSeriesPath {
  pointPath: string | null
  errorBarPath: string | null
}

const renderedSeriesPaths = computed<RenderedSeriesPath[]>(() =>
  props.track.seriesPaths.map((seriesPath) => {
    const pointPath = waveformPointSeriesPath(
      seriesPath.series.pointType,
      seriesPath.pointRenderPoints.map((point) => ({
        x: props.track.xScale(point.x),
        y: seriesPath.yScale(point.y),
      })),
    )
    const capHalfWidth = seriesPath.series.errorBar.capWidth / 2
    const errorBarPath = seriesPath.errorBarRenderPoints
      .map((point) => {
        const { lower, upper } = resolveWaveformPointErrors(point)
        const x = props.track.xScale(point.x)
        const lowerY = seriesPath.yScale(point.y - lower)
        const upperY = seriesPath.yScale(point.y + upper)
        return [
          `M${x - capHalfWidth},${lowerY}H${x + capHalfWidth}`,
          `M${x},${lowerY}V${upperY}`,
          `M${x - capHalfWidth},${upperY}H${x + capHalfWidth}`,
        ].join('')
      })
      .join('')
    return { ...seriesPath, pointPath, errorBarPath: errorBarPath || null }
  }),
)
</script>

<template>
  <g
    v-if="!track.isEmpty && track.hasVisibleSeries"
    class="waveform-track__series"
    :clip-path="`url(#${clipPathId}-${track.index})`"
  >
    <g
      v-for="seriesPath in renderedSeriesPaths"
      :key="seriesPath.series.id"
      class="waveform-track__series-item waveform-chart__series"
      :data-series-id="seriesPath.series.id"
      :data-series-name="seriesPath.series.name || undefined"
    >
      <path
        v-if="seriesPath.path"
        class="waveform-track__line waveform-chart__line"
        :data-series-id="seriesPath.series.id"
        :data-series-name="seriesPath.series.name || undefined"
        :data-y-axis-index="seriesPath.yAxisIndex"
        :data-line-type="seriesPath.series.lineType"
        :d="seriesPath.path"
        :stroke="seriesPath.series.color"
      />

      <g
        v-if="seriesPath.series.errorBar.visible"
        class="waveform-track__error-bars waveform-chart__error-bars"
        :data-series-id="seriesPath.series.id"
      >
        <path
          v-if="seriesPath.errorBarPath"
          class="waveform-track__error-bar waveform-chart__error-bar"
          :d="seriesPath.errorBarPath"
          :stroke="seriesPath.series.errorBar.color || seriesPath.series.color"
          :stroke-width="seriesPath.series.errorBar.width"
        />
      </g>

      <g
        v-if="seriesPath.series.pointType !== 'none'"
        class="waveform-track__points waveform-chart__points"
        :data-series-id="seriesPath.series.id"
        :data-point-type="seriesPath.series.pointType"
      >
        <path
          v-if="seriesPath.pointPath"
          class="waveform-track__point waveform-chart__point"
          :d="seriesPath.pointPath"
          :fill="seriesPath.series.color"
        />
      </g>
    </g>
  </g>
</template>

<style scoped>
.waveform-track__line {
  fill: none;
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.waveform-track__error-bar {
  fill: none;
}

.waveform-track__point,
.waveform-track__error-bar {
  pointer-events: none;
}
</style>

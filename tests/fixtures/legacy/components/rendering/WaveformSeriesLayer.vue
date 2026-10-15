<script setup lang="ts">
import { computed } from 'vue'

import { seriesGeometry } from '@/rendering/geometry/seriesGeometry'
import type { TrackLayout, TrackSeriesPath } from '@/components/core/types'
import { waveformLineDasharray } from '@/components/rendering/seriesStyle'

const props = defineProps<{
  track: TrackLayout
  clipPathId: string
}>()

interface RenderedSeriesPath extends TrackSeriesPath {
  pointPath: string | null
  errorBarPath: string | null
}

const renderedSeriesPaths = computed<RenderedSeriesPath[]>(() =>
  props.track.seriesPaths.map((seriesPath) => ({
    ...seriesPath,
    ...seriesGeometry(seriesPath, props.track),
  })),
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
      :key="seriesPath.presentationKey ?? seriesPath.series.id"
      :opacity="seriesPath.opacity ?? 1"
      :clip-path="seriesPath.animationClip ? `url(#${seriesPath.animationClip.id})` : undefined"
      class="waveform-track__series-item waveform-chart__series"
      :data-series-id="seriesPath.series.id"
      :data-series-name="seriesPath.series.name || undefined"
    >
      <defs v-if="seriesPath.animationClip">
        <clipPath :id="seriesPath.animationClip.id" clipPathUnits="userSpaceOnUse">
          <rect
            :x="seriesPath.animationClip.x"
            :width="seriesPath.animationClip.width"
            :height="track.height"
          />
        </clipPath>
      </defs>
      <path
        v-if="seriesPath.path"
        class="waveform-track__line waveform-chart__line"
        :data-series-id="seriesPath.series.id"
        :data-series-name="seriesPath.series.name || undefined"
        :data-y-axis-index="seriesPath.yAxisIndex"
        :data-line-type="seriesPath.series.lineType"
        :data-line-style="seriesPath.series.lineStyle"
        :d="seriesPath.path"
        :stroke="seriesPath.series.color"
        :stroke-dasharray="waveformLineDasharray(seriesPath.series.lineStyle)"
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
  stroke-width: 1;
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

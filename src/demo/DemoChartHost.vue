<script setup lang="ts">
import { ref } from 'vue'

import { WaveformChart } from '../components'
import type { DemoChartModel } from './types'

const model = defineModel<DemoChartModel>('model', { required: true })

const waveformChartRef = ref<{ resetViewport: (trackIndex?: number) => void }>()

function resetViewport() {
  waveformChartRef.value?.resetViewport()
}

defineExpose({ resetViewport })
</script>

<template>
  <section class="chart-panel">
    <WaveformChart
      ref="waveformChartRef"
      v-model:annotations="model.annotations"
      v-model:hidden-series-ids="model.hiddenSeriesIds"
      :data="model.data"
      :min-zoom-span="model.minZoomSpan"
      :min-visible-points="5"
      :initial-x-domain="model.initialXDomain"
      :display-mode="model.displayMode"
      :overlay-mode="model.overlayMode"
      :grid="{
        rowCount: model.rowCount,
        columnCount: model.columnCount,
        showPagination: true,
        trackLines: model.gridTrackLines,
      }"
      :title="model.title"
      :legend="{
        position: model.legendPosition,
        orientation: model.legendOrientation,
        backgroundColor: model.legendBackgroundColor,
        interactive: true,
      }"
      :frame-style="model.frameStyle"
      :axes="model.axes"
      :clean-view="model.cleanView"
      :presentation-mode="model.presentationMode"
      :show-tooltip="model.showTooltip"
      :plot-margin="model.plotMargin"
      :zero-line="model.zeroLine"
      :frame-number="model.frameWatermarkVisible ? 1 : undefined"
      :annotations-visible="model.annotationsVisible"
      :interaction-mode="model.interactionMode"
      @zoom-end="model.handleZoomEnd"
      @zoom-reset="model.resetWaveformViewport"
    />
  </section>
</template>

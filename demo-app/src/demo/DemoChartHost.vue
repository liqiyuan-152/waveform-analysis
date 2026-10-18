<script setup lang="ts">
import { computed, ref } from 'vue'

import { WaveformChart } from 'waveform-analysis/vue'
import type { DemoChartModel } from './types'
import { alignDemoDomain } from './alignDemoDomain'

const model = defineModel<DemoChartModel>('model', { required: true })
const xDomainStrategy = { type: 'integer-ms' as const, includeExplicit: true }
const panXDomain = computed(() => alignDemoDomain(model.value.recordDomain))

const waveformChartRef = ref<{ resetViewport: (trackIndex?: number) => void }>()

function resetViewport(trackIndex?: number) {
  waveformChartRef.value?.resetViewport(trackIndex)
}

defineExpose({ resetViewport })
</script>

<template>
  <section class="chart-panel">
    <div
      v-if="model.loading || model.errors.length"
      class="remote-window-status"
      aria-live="polite"
    >
      <span v-if="model.loading" role="status">正在加载当前时间范围…</span>
      <template v-if="model.errors.length">
        <span role="alert">{{ model.errors.join('；') }}</span>
        <button type="button" :disabled="model.loading" @click="model.retry()">重试</button>
      </template>
    </div>
    <WaveformChart
      ref="waveformChartRef"
      layout-preset="edge-compact"
      unit-display-mode="channel-label"
      v-model:annotations="model.annotations"
      v-model:hidden-series-ids="model.hiddenSeriesIds"
      :data="model.data"
      :min-visible-points="2"
      :min-zoom-span="model.minZoomSpan"
      :max-zoom-scale="null"
      :pan-x-domain="panXDomain"
      :integer-zoom="model.integerZoom"
      :initial-x-domain="model.initialXDomain"
      :x-domain-strategy="xDomainStrategy"
      :display-mode="model.displayMode"
      :overlay-mode="model.overlayMode"
      :grid="{
        rowCount: model.rowCount,
        columnCount: model.columnCount,
        showPagination: true,
        fillIncompleteLastRow: true,
        trackLines: model.gridTrackLines,
      }"
      :title="model.title"
      :legend="{
        position: model.legendPosition,
        orientation: model.legendOrientation,
        backgroundColor: model.legendBackgroundColor,
        interactive: true,
      }"
      :control-theme="model.controlTheme"
      :frame-style="model.frameStyle"
      :axes="model.axes"
      :clean-view="model.cleanView"
      :presentation-mode="model.presentationMode"
      :show-tooltip="model.showTooltip"
      :point-size="model.pointSize"
      :plot-margin="model.plotMargin"
      :zero-line="model.zeroLine"
      :frame-number="model.frameWatermarkVisible ? 1 : undefined"
      :annotations-visible="model.annotationsVisible"
      v-model:interaction-mode="model.interactionMode"
      :toolbar="model.toolbarOptions ?? model.toolbarVisible"
      pannable
      @zoom-intent="model.handleZoomIntent"
      @zoom-change="model.handleZoomChange"
      @zoom-end="model.handleZoomEnd"
      @pan-end="model.handlePanEnd"
      @zoom-reset="model.resetWaveformViewport"
    />
  </section>
</template>

<style scoped>
.chart-panel {
  position: relative;
}

.remote-window-status {
  position: absolute;
  top: 6px;
  right: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 24px);
  padding: 6px 10px;
  border: 1px solid var(--demo-border);
  border-radius: 4px;
  background: var(--demo-panel);
  color: var(--demo-text);
}
</style>

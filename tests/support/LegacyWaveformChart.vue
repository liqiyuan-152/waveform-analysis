<script setup lang="ts">
import { useWaveformChartController } from '../fixtures/legacy/components/core/useWaveformChartController'
import type {
  ResolvedWaveformChartProps,
  WaveformChartEmit,
  WaveformChartProps,
} from '../../src/components/core/waveformChartTypes'
import WaveformChartView from '../fixtures/legacy/components/WaveformChartView.vue'
import { globalAnimator } from '../../src/animation/core/Animator'

const props = withDefaults(defineProps<WaveformChartProps>(), {
  animationEnabled: true,
  displayMode: 'independent',
  overlayMode: 'single-axis',
  unitDisplayMode: 'axis',
  layoutPreset: 'default',
  yLabel: '幅值',
  lineColor: '#0960bd',
  showTooltip: true,
  zoomable: true,
  integerZoom: false,
  pannable: false,
  minVisiblePoints: 0,
  xDomainStrategy: () => ({ type: 'integer-ms' }),
  timeUnit: 'ms',
  frameNumber: undefined,
  annotations: () => [],
  annotationsVisible: true,
  interactionMode: undefined,
  grid: () => ({ rowCount: 2, columnCount: 1, showPagination: true }),
  rendering: () => ({}),
  plotMargin: () => ({}),
  legend: () => ({ position: 'top-right', orientation: 'auto' }),
  defaultHiddenSeriesIds: () => [],
  cleanView: false,
  presentationMode: false,
  zeroLine: () => ({ visible: true }),
})
const emit = defineEmits<WaveformChartEmit>()
const controller = useWaveformChartController(props as ResolvedWaveformChartProps, emit)

defineExpose({
  benchmarkIsStable: () => controller.samplingReady() && globalAnimator.getAnimationCount() === 0,
  exportImage: controller.exportImage,
  zoomIn: controller.zoomIn,
  zoomOut: controller.zoomOut,
  fitToData: controller.fitToData,
  setInteractionMode: controller.setInteractionMode,
  getControlState: controller.getControlState,
  resetViewport: controller.resetViewport,
  setViewportDomain: controller.setViewportDomain,
})
</script>

<template>
  <WaveformChartView :controller="controller" />
</template>

<style src="../fixtures/legacy/components/WaveformChart.css"></style>

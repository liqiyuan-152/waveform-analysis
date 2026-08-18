<script setup lang="ts">
import { useWaveformChartController } from './core/useWaveformChartController'
import type {
  ResolvedWaveformChartProps,
  WaveformChartEmit,
  WaveformChartProps,
} from './core/waveformChartTypes'
import WaveformChartView from './WaveformChartView.vue'

const props = withDefaults(defineProps<WaveformChartProps>(), {
  displayMode: 'independent',
  overlayMode: 'single-axis',
  yLabel: '幅值',
  lineColor: '#0960bd',
  showTooltip: true,
  zoomable: true,
  pannable: false,
  minVisiblePoints: 0,
  xDomainStrategy: () => ({ type: 'data' }),
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
  zeroLine: () => ({ visible: false }),
})
const emit = defineEmits<WaveformChartEmit>()
const controller = useWaveformChartController(props as ResolvedWaveformChartProps, emit)

defineExpose({
  resetViewport: controller.resetViewport,
  setViewportDomain: controller.setViewportDomain,
})
</script>

<template>
  <WaveformChartView :controller="controller" />
</template>

<style src="./WaveformChart.css"></style>

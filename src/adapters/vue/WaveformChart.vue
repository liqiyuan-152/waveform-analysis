<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import type { WaveformChartProps } from '../../types/options'
import type { WaveformChartEvents } from '../../types/native'
import { VueChartAdapter } from './VueChartAdapter'
import { snapshotVueOptions } from './vueOptionSnapshot'

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
const emit = defineEmits<WaveformChartEvents>()
const host = shallowRef<HTMLDivElement>()
const adapter = new VueChartAdapter(emit)
const hostStyle = computed(() => ({
  width: Number.isFinite(props.width) ? `${Math.max(0, props.width!)}px` : '100%',
  height: Number.isFinite(props.height) ? `${Math.max(180, props.height!)}px` : '100%',
  minHeight: '180px',
  minWidth: '0',
}))

const readOptions = () => snapshotVueOptions(props)
onMounted(() => adapter.attachSnapshot(host.value!, readOptions()))
watch(readOptions, (options) => adapter.updateSnapshot(options), { flush: 'post' })
onBeforeUnmount(() => adapter.dispose())

defineExpose({
  exportImage: adapter.exportImage.bind(adapter),
  zoomIn: adapter.zoomIn.bind(adapter),
  zoomOut: adapter.zoomOut.bind(adapter),
  fitToData: adapter.fitToData.bind(adapter),
  setInteractionMode: adapter.setInteractionMode.bind(adapter),
  getControlState: adapter.getControlState.bind(adapter),
  resetViewport: adapter.resetViewport.bind(adapter),
  setViewportDomain: adapter.setViewportDomain.bind(adapter),
})
</script>

<template>
  <div ref="host" class="waveform-chart-host" :style="hostStyle" />
</template>

<style src="../../styles/native.css"></style>

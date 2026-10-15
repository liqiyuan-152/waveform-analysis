<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  init,
  type WaveformAnnotation,
  type WaveformChartInstance,
  type WaveformData,
  type WaveformInteractionMode,
} from 'waveform-analysis/native'
import { diagnostics } from '../shared/diagnostics'
import { ExampleImageDownload } from '../shared/ExampleImageDownload'

const props = defineProps<{
  data: WaveformData
  narrow: boolean
  onRendered: (revision: number) => void
}>()
const container = ref<HTMLDivElement>()
let chart: WaveformChartInstance | undefined
let download: ExampleImageDownload | undefined
const subscriptions: Array<() => void> = []
const annotations = shallowRef<WaveformAnnotation[]>([])
const hiddenSeriesIds = shallowRef<string[]>([])
const interactionMode = ref<WaveformInteractionMode>('zoom')
const exportMessage = ref('')
const exporting = ref(false)
const modes: Array<{ value: WaveformInteractionMode; label: string }> = [
  { value: 'zoom', label: '缩放模式' },
  { value: 'pan', label: '平移模式' },
  { value: 'annotation', label: '标注模式' },
]

onMounted(() => {
  chart = init(container.value!, {
    data: props.data,
    animationEnabled: false,
    toolbar: true,
    pannable: true,
    legend: { interactive: true },
    grid: { rowCount: 1, columnCount: 1 },
    annotations: annotations.value,
    hiddenSeriesIds: hiddenSeriesIds.value,
    interactionMode: interactionMode.value,
  })
  diagnostics.mounted(container.value!)
  // Read current props from one stable subscription, avoiding stale captured callbacks.
  subscriptions.push(
    chart.on('rendered', ({ revision }) => props.onRendered(revision)),
    chart.on('update:annotations', (value) => (annotations.value = value)),
    chart.on('update:hidden-series-ids', (value) => (hiddenSeriesIds.value = value)),
    chart.on('update:interactionMode', (value) => (interactionMode.value = value)),
  )
  download = new ExampleImageDownload(chart, container.value!.ownerDocument, (message, busy) => {
    exportMessage.value = message
    exporting.value = busy
  })
})
// Vue owns controlled values; core requests become new refs and are acknowledged here.
watch([annotations, hiddenSeriesIds, interactionMode], ([annotations, hiddenSeriesIds, mode]) =>
  chart?.setOption({ annotations, hiddenSeriesIds, interactionMode: mode }),
)
watch(
  () => props.data,
  (data) => chart?.setOption({ data }),
)
watch(
  () => props.narrow,
  () => chart?.resize(),
  { flush: 'post' },
)
onBeforeUnmount(() => {
  subscriptions.splice(0).forEach((cancel) => cancel())
  download?.dispose()
  chart?.dispose()
  if (chart) diagnostics.unmounted(chart)
})
</script>

<template>
  <section class="example-chart">
    <div class="example-controls" aria-label="图表操作">
      <button @click="chart?.zoomIn()">放大</button>
      <button @click="chart?.zoomOut()">缩小</button>
      <button @click="chart?.resetViewport()">重置视口</button>
      <button @click="chart?.fitToData()">显示全部</button>
      <button
        v-for="mode in modes"
        :key="mode.value"
        :aria-pressed="interactionMode === mode.value"
        @click="interactionMode = mode.value"
      >
        {{ mode.label }}
      </button>
      <button @click="hiddenSeriesIds = hiddenSeriesIds.includes('b') ? [] : ['b']">
        切换通道 2
      </button>
      <button @click="annotations = []">清空标注</button>
      <button :disabled="exporting" @click="download?.save('svg')">导出 SVG</button>
      <button :disabled="exporting" @click="download?.save('png')">导出 PNG</button>
    </div>
    <p class="example-state" aria-live="polite">
      标注 {{ annotations.length }} 条；隐藏 {{ hiddenSeriesIds.length }} 个通道；模式
      {{ interactionMode }}
    </p>
    <p class="example-export-status" role="status">{{ exportMessage }}</p>
    <div ref="container" class="example-host" :style="{ width: narrow ? '360px' : '100%' }" />
  </section>
</template>

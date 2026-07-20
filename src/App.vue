<script setup lang="ts">
import { InputNumber, Radio, Tag } from 'ant-design-vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  WaveformChart,
  type WaveformAnnotation,
  type WaveformData,
  type WaveformDisplayMode,
  type WaveformInteractionMode,
  type WaveformSeries,
} from './components'
import waveformJson from './data/wData.json'

interface WaveformSourceRow {
  chnl: string
  chnl_id: number
  dat_unit: string
  data: number[]
  dev: number
  shot: number
  time: number[]
  time_unit: 'ms'
}

const importedSourceRows = waveformJson as unknown as WaveformSourceRow[]
const testChannelRows: WaveformSourceRow[] = importedSourceRows.slice(0, 2).map((row, index) => ({
  ...row,
  chnl: `TEST_CH_${index + 1}`,
  chnl_id: 9001 + index,
  data: row.data.map(
    (value, sampleIndex) =>
      value * (index === 0 ? 0.72 : 1.12) +
      Math.sin(sampleIndex / (index === 0 ? 11 : 18)) * (index === 0 ? 0.015 : 0.01),
  ),
}))
const sourceRows = [...importedSourceRows, ...testChannelRows]
const visibleRange = ref<[number, number] | null>(null)
const displayMode = ref<WaveformDisplayMode>('independent')
const rowCount = ref(2)
const columnCount = ref(1)
const annotations = ref<WaveformAnnotation[]>([])
const annotationsVisible = ref(true)
const interactionMode = ref<WaveformInteractionMode>('zoom')

const resolveChartHeight = () =>
  Math.min(800, Math.max(560, (typeof window === 'undefined' ? 750 : window.innerHeight) - 190))
const chartHeight = ref(resolveChartHeight())

const waveformSeries: WaveformSeries[] = sourceRows.map((row) => {
  const pointCount = Math.min(row.time.length, row.data.length)
  return {
    id: String(row.chnl_id),
    name: row.chnl,
    unit: row.dat_unit,
    data: {
      kind: 'points',
      points: Array.from({ length: pointCount }, (_, index) => ({
        x: row.time[index] / 1000,
        y: row.data[index],
      })),
    },
  }
})

const chartData: WaveformData = { kind: 'series', series: waveformSeries }
const totalPointCount = waveformSeries.reduce((total, series) => {
  const seriesPointCount =
    series.data.kind === 'points' ? series.data.points.length : series.data.values.length
  return total + seriesPointCount
}, 0)
const initialTimeRange: [number, number] = [
  Math.min(...sourceRows.flatMap((row) => row.time)) / 1000,
  Math.max(...sourceRows.flatMap((row) => row.time)) / 1000,
]
const displayedRange = computed(() => visibleRange.value ?? initialTimeRange)
const formatMilliseconds = (seconds: number) =>
  (seconds * 1000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })

function updateChartHeight() {
  chartHeight.value = resolveChartHeight()
}

watch(displayMode, () => {
  visibleRange.value = null
})

watch([rowCount, columnCount], () => {
  visibleRange.value = null
})

onMounted(() => {
  window.addEventListener('resize', updateChartHeight)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateChartHeight)
})
</script>

<template>
  <main class="workspace">
    <header class="workspace__header">
      <div>
        <p class="workspace__eyebrow">Vue 3 · TypeScript · D3</p>
        <h1>波形分析组件</h1>
      </div>
    </header>

    <section class="control-bar" aria-label="波形图控制与摘要">
      <div class="control-bar__leading">
        <Tag color="blue">真实 + 测试数据</Tag>
        <Radio.Group
          v-model:value="displayMode"
          class="display-mode-control"
          button-style="solid"
          size="small"
          aria-label="波形展示方式"
        >
          <Radio.Button value="independent">单独坐标</Radio.Button>
          <Radio.Button value="separated">多道分离</Radio.Button>
          <Radio.Button value="compact">多道紧凑</Radio.Button>
        </Radio.Group>
        <div class="grid-size-control" aria-label="波形网格尺寸">
          <span>网格</span>
          <InputNumber v-model:value="rowCount" :min="1" :max="10" size="small" />
          <span>行 ×</span>
          <InputNumber v-model:value="columnCount" :min="1" :max="10" size="small" />
          <span>列</span>
        </div>
      </div>
      <div class="metrics">
        <span>{{ sourceRows.length }} 通道</span>
        <span>{{ totalPointCount.toLocaleString() }} 数据点</span>
        <span>{{ annotations.length }} 标注</span>
        <span>炮号 {{ sourceRows[0]?.shot }}</span>
        <span>设备 {{ sourceRows[0]?.dev }}</span>
        <span>
          范围 {{ formatMilliseconds(displayedRange[0]) }}–{{
            formatMilliseconds(displayedRange[1])
          }}
          ms
        </span>
      </div>
    </section>

    <section class="chart-panel">
      <WaveformChart
        :data="chartData"
        :display-mode="displayMode"
        :grid="{ rowCount, columnCount, showPagination: true }"
        :height="chartHeight"
        :frame-number="1"
        v-model:annotations="annotations"
        v-model:annotations-visible="annotationsVisible"
        v-model:interaction-mode="interactionMode"
        @zoom-change="visibleRange = $event"
      />
    </section>
  </main>
</template>

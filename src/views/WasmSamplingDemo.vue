<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { InputNumber, RadioButton, RadioGroup, Select } from 'ant-design-vue'

import { WaveformChart } from '../components'
import type {
  WaveformData,
  WaveformRenderingOptions,
  WaveformSamplingDiagnostics,
  WaveformSamplingMode,
  WaveformSamplingStrategy,
} from '../types'

const SERIES_COUNT = 10
const POINTS_PER_SERIES = 100_000

const colors = [
  '#1677ff',
  '#d4380d',
  '#389e0d',
  '#d46b08',
  '#08979c',
  '#c41d7f',
  '#531dab',
  '#096dd9',
  '#ad6800',
  '#237804',
]

const strategyOptions: Array<{ label: string; value: WaveformSamplingStrategy }> = [
  { label: '自动（peak）', value: 'auto' },
  { label: 'Peak', value: 'peak' },
  { label: 'LTTB', value: 'lttb' },
  { label: 'MinMax', value: 'minmax' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
  { label: 'Average', value: 'average' },
  { label: 'Sum', value: 'sum' },
  { label: 'None', value: 'none' },
]

function createDenseData(): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: SERIES_COUNT }, (_, seriesIndex) => {
      const values = new Float32Array(POINTS_PER_SERIES)
      for (let index = 0; index < values.length; index += 1) {
        const t = index / 1_000
        const pulse = index % (8_123 + seriesIndex * 113) < 3 ? 3.5 + seriesIndex / 4 : 0
        values[index] =
          Math.sin(t * (0.8 + seriesIndex / 14)) * (1.2 + seriesIndex / 10) +
          Math.cos(t * (2.1 + seriesIndex / 20)) * 0.35 +
          pulse
      }
      return {
        id: `dense-${seriesIndex + 1}`,
        trackId: 'dense-overlay',
        name: `通道 ${String(seriesIndex + 1).padStart(2, '0')}`,
        color: colors[seriesIndex],
        data: { kind: 'typed-samples' as const, values, sampleRate: 1_000 },
      }
    }),
  }
}

const data = createDenseData()
const mode = ref<WaveformSamplingMode>('auto')
const strategy = ref<WaveformSamplingStrategy>('peak')
const autoThreshold = ref(1_000)
const maxPointsPerPixel = ref(3)
const diagnostics = reactive<Record<string, WaveformSamplingDiagnostics | undefined>>({})

const rendering = computed<WaveformRenderingOptions>(() => ({
  sampling: {
    mode: mode.value,
    strategy: strategy.value,
    autoThreshold: autoThreshold.value,
    maxPointsPerPixel: maxPointsPerPixel.value,
    rawPointLimit: 100_000,
    wasmFailureFallback: 'javascript',
  },
}))
const rows = computed(() =>
  Array.from({ length: SERIES_COUNT }, (_, index) => {
    const id = `dense-${index + 1}`
    return { id, name: `通道 ${String(index + 1).padStart(2, '0')}`, diagnostic: diagnostics[id] }
  }),
)

function onSamplingComplete(diagnostic: WaveformSamplingDiagnostics) {
  diagnostics[diagnostic.seriesId] = diagnostic
}

function pointCount(value: number | undefined) {
  return value === undefined ? '--' : value.toLocaleString('en-US')
}
</script>

<template>
  <main class="sampling-demo">
    <header class="sampling-demo__toolbar">
      <div>
        <h1>WASM 多分辨率采样</h1>
        <p>10 条 TypedArray 通道，每条 {{ POINTS_PER_SERIES.toLocaleString('en-US') }} 点</p>
      </div>
      <RadioGroup v-model:value="mode" button-style="solid" aria-label="采样执行模式">
        <RadioButton value="auto">Auto</RadioButton>
        <RadioButton value="wasm">WASM</RadioButton>
        <RadioButton value="raw">Raw</RadioButton>
      </RadioGroup>
    </header>

    <section class="sampling-demo__controls" aria-label="采样参数">
      <label>
        <span>策略</span>
        <Select v-model:value="strategy" :options="strategyOptions" size="small" />
      </label>
      <label>
        <span>阈值</span>
        <InputNumber
          v-model:value="autoThreshold"
          :min="1"
          :max="100000"
          :step="100"
          size="small"
        />
      </label>
      <label>
        <span>每像素点数</span>
        <InputNumber
          v-model:value="maxPointsPerPixel"
          :min="0.25"
          :max="16"
          :step="0.25"
          size="small"
        />
      </label>
    </section>

    <section class="sampling-demo__workspace">
      <div class="sampling-demo__chart">
        <WaveformChart
          :data="data"
          :rendering="rendering"
          :grid="{ rowCount: 1, columnCount: 1, showPagination: false }"
          :legend="{ position: 'top-right', orientation: 'vertical' }"
          :title="{ visible: true, text: '多系列采样与缓存诊断', align: 'left' }"
          x-label="时间（s）"
          time-unit="s"
          @sampling-complete="onSamplingComplete"
        />
      </div>

      <aside class="sampling-demo__diagnostics" aria-label="每系列采样诊断">
        <div class="sampling-demo__diagnostic-header">
          <span>系列</span>
          <span>后端</span>
          <span>源点</span>
          <span>可见</span>
          <span>渲染</span>
          <span>耗时</span>
          <span>缓存</span>
        </div>
        <div v-for="row in rows" :key="row.id" class="sampling-demo__diagnostic-row">
          <span data-label="系列">{{ row.name }}</span>
          <span data-label="后端">{{ row.diagnostic?.backend ?? '--' }}</span>
          <span data-label="源点">{{ pointCount(row.diagnostic?.sourcePointCount) }}</span>
          <span data-label="可见">{{ pointCount(row.diagnostic?.visiblePointCount) }}</span>
          <span data-label="渲染">{{ pointCount(row.diagnostic?.renderedPointCount) }}</span>
          <span data-label="耗时">{{
            row.diagnostic ? `${row.diagnostic.durationMs.toFixed(2)} ms` : '--'
          }}</span>
          <span data-label="缓存" :class="{ 'is-hit': row.diagnostic?.cacheHit }">
            {{ row.diagnostic ? (row.diagnostic.cacheHit ? '命中' : '未命中') : '--' }}
          </span>
        </div>
      </aside>
    </section>
  </main>
</template>

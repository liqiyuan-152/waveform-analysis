<script setup lang="ts">
import { computed, ref } from 'vue'
import { InputNumber, RadioButton, RadioGroup } from 'ant-design-vue'

import { WaveformChart, type WaveformData } from '../components'

type RangeMode = 'auto' | 'global' | 'channel'

const rangeMode = ref<RangeMode>('global')
const globalMinimum = ref(-80)
const globalMaximum = ref(80)
const voltageMinimum = ref(-65)
const voltageMaximum = ref(65)
const currentMinimum = ref(-260)
const currentMaximum = ref(260)

const chartData: WaveformData = {
  kind: 'series',
  series: [
    {
      id: 'voltage',
      name: '电压',
      unit: 'V',
      color: '#1677ff',
      data: {
        kind: 'points',
        points: Array.from({ length: 800 }, (_, index) => {
          const x = index / 80
          const pulse = index % 240 >= 112 && index % 240 <= 122 ? 58 : 0
          return { x, y: 48 * Math.sin(x * Math.PI * 1.5) + pulse }
        }),
      },
    },
    {
      id: 'current',
      name: '电流',
      unit: 'mA',
      color: '#d4380d',
      data: {
        kind: 'points',
        points: Array.from({ length: 800 }, (_, index) => {
          const x = index / 80
          const pulse = index % 300 >= 184 && index % 300 <= 192 ? -210 : 0
          return { x, y: 185 * Math.cos(x * Math.PI) + pulse }
        }),
      },
    },
  ],
}

function orderedDomain(minimum: number, maximum: number): [number, number] | undefined {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum === maximum) {
    return undefined
  }
  return minimum < maximum ? [minimum, maximum] : [maximum, minimum]
}

const yDomain = computed<[number, number] | undefined>(() =>
  rangeMode.value === 'global'
    ? orderedDomain(globalMinimum.value, globalMaximum.value)
    : undefined,
)
const yDomains = computed<Record<string, [number, number]> | undefined>(() => {
  if (rangeMode.value !== 'channel') return undefined
  const voltage = orderedDomain(voltageMinimum.value, voltageMaximum.value)
  const current = orderedDomain(currentMinimum.value, currentMaximum.value)
  return {
    ...(voltage ? { voltage } : {}),
    ...(current ? { current } : {}),
  }
})
const rangeSummary = computed(() => {
  if (rangeMode.value === 'auto') return '自动计算'
  if (rangeMode.value === 'global') {
    return yDomain.value ? `${yDomain.value[0]} ～ ${yDomain.value[1]}` : '自动计算'
  }
  const voltage = yDomains.value?.voltage
  const current = yDomains.value?.current
  return `电压 ${voltage?.[0] ?? '-'} ～ ${voltage?.[1] ?? '-'} V · 电流 ${
    current?.[0] ?? '-'
  } ～ ${current?.[1] ?? '-'} mA`
})
</script>

<template>
  <main class="fixed-domain-demo">
    <header class="fixed-domain-demo__toolbar">
      <div>
        <h1>固定振幅范围</h1>
        <p>当前范围：{{ rangeSummary }}</p>
      </div>
      <RadioGroup v-model:value="rangeMode" button-style="solid" aria-label="Y 轴范围模式">
        <RadioButton value="auto">自动</RadioButton>
        <RadioButton value="global">全局固定</RadioButton>
        <RadioButton value="channel">按通道固定</RadioButton>
      </RadioGroup>
    </header>

    <section class="fixed-domain-demo__range-controls">
      <template v-if="rangeMode === 'global'">
        <label>
          <span>下限</span>
          <InputNumber v-model:value="globalMinimum" aria-label="全局振幅下限" />
        </label>
        <label>
          <span>上限</span>
          <InputNumber v-model:value="globalMaximum" aria-label="全局振幅上限" />
        </label>
      </template>
      <template v-else-if="rangeMode === 'channel'">
        <strong>电压</strong>
        <label>
          <span>下限</span>
          <InputNumber v-model:value="voltageMinimum" aria-label="电压振幅下限" />
        </label>
        <label>
          <span>上限</span>
          <InputNumber v-model:value="voltageMaximum" aria-label="电压振幅上限" />
        </label>
        <strong>电流</strong>
        <label>
          <span>下限</span>
          <InputNumber v-model:value="currentMinimum" aria-label="电流振幅下限" />
        </label>
        <label>
          <span>上限</span>
          <InputNumber v-model:value="currentMaximum" aria-label="电流振幅上限" />
        </label>
      </template>
      <span v-else class="fixed-domain-demo__auto-state">根据可见数据自动计算</span>
    </section>

    <section class="fixed-domain-demo__chart">
      <WaveformChart
        :data="chartData"
        :y-domain="yDomain"
        :y-domains="yDomains"
        display-mode="independent"
        :grid="{ rowCount: 2, columnCount: 1, showPagination: false }"
        :title="{ visible: true, text: '振幅上下限示例', align: 'left' }"
        :zero-line="{ visible: true, color: '#98a2b3', width: 1, dash: '5 4' }"
        :legend="{ position: 'top-right', backgroundColor: 'rgba(255,255,255,0.8)' }"
        x-label="时间（s）"
        time-unit="s"
        :show-tooltip="true"
      />
    </section>
  </main>
</template>

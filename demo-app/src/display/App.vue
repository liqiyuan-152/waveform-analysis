<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { Alert, ConfigProvider, Segmented } from 'ant-design-vue'
import type { Waveform, WaveformOptions, WaveformSeries } from 'waveform-analysis/display'
import WaveformPreview from './components/WaveformPreview.vue'
import ConfigPanel from './components/config-panel/ConfigPanel.vue'
import AnimationPanel from './components/AnimationPanel.vue'
import { animationScenario } from './animation-scenarios'
import { OptionsDraft } from './config/OptionsDraft'
import { initialOptions, originalSeries } from './config/initial'
import { useTheme } from '../theme/useTheme'
import { displayThemeColors } from '../theme/displayTheme'
import { scientificSeries } from './scientific-data'
const { dark } = useTheme()
const datasets = { original: originalSeries, scientific: scientificSeries }
const active = ref<'original' | 'scientific'>('original')
const series = shallowRef<WaveformSeries[]>(datasets.original)
const chart = shallowRef<Waveform | null>(null)
const options = shallowRef<WaveformOptions>({})
const empty = ref(false),
  error = ref('')
const draft = new OptionsDraft(initialOptions)
for (const [path, color] of Object.entries(displayThemeColors(dark.value))) draft.set(path, color)
const previewOptions = draft.options
const editedColors = new Set<string>()
let scenarioVersion = 0
let extremeAxes: WaveformOptions['yAxes']
const previewData = computed(() => (empty.value ? [] : series.value))
function ready(value: Waveform) {
  chart.value = value
  options.value = value.getOptions()
}
function edit(path: string, value: unknown) {
  try {
    chart.value?.updateOptions(draft.set(path, value))
    options.value = chart.value!.getOptions()
    editedColors.add(path)
    error.value = ''
  } catch (failure) {
    error.value = String(failure)
  }
}
watch(dark, (value) => {
  for (const [path, color] of Object.entries(displayThemeColors(value))) {
    if (!editedColors.has(path)) chart.value?.updateOptions(draft.set(path, color))
  }
  if (chart.value) options.value = chart.value.getOptions()
})
function updateSeries(data: WaveformSeries[]) {
  series.value = data
  datasets[active.value] = data
}
function mode(value: 'single' | 'multiple') {
  if ((options.value.yAxes?.length === 1) === (value === 'single')) return
  const change = draft.switchAxes(value, series.value)
  chart.value?.update({ data: empty.value ? [] : change.data, options: change.options })
  updateSeries(change.data)
  options.value = chart.value!.getOptions()
}
function switchDataset(key: 'original' | 'scientific') {
  active.value = key
  series.value = datasets[key]
  empty.value = false
}
function replayEntrance() {
  if (!chart.value || empty.value || !series.value.length) return
  chart.value.updateData([])
  chart.value.updateData(series.value)
}
function scenario(name: string) {
  if (name === 'append' && !series.value.length) return
  const data = animationScenario(name, ++scenarioVersion, series.value)
  const patch = draft.set(
    'layout.horizontalPadding',
    name === 'auto-padding' ? undefined : { left: 90, right: 90 },
  )
  if (extremeAxes) {
    Object.assign(patch, draft.set('yAxes', extremeAxes))
    extremeAxes = undefined
  }
  if (name === 'extreme') {
    extremeAxes = draft.options.yAxes ?? [{ id: 'left' }]
    Object.assign(
      patch,
      draft.set(
        'yAxes',
        extremeAxes.map((axis) => ({ ...axis, min: -4, max: 4 })),
      ),
    )
  }
  chart.value?.update({ data, options: patch })
  series.value = data
  empty.value = false
  options.value = chart.value!.getOptions()
}
</script>
<template>
  <ConfigProvider component-size="small">
    <main class="workspace" :data-theme="dark ? 'dark' : 'light'">
      <aside class="control-pane" aria-label="图表配置与动画测试">
        <div class="control-toolbar">
          <div class="toolbar-row">
            <span>测试数据</span
            ><Segmented
              :value="active"
              aria-label="测试数据"
              :options="[
                { label: '原始数据', value: 'original' },
                { label: '小数值测试', value: 'scientific' },
              ]"
              @change="(value) => switchDataset(value as 'original' | 'scientific')"
            />
          </div>
        </div>
        <AnimationPanel
          v-if="chart"
          :options="options"
          :replay-disabled="empty || !series.length"
          :append-disabled="!series.length"
          @field="edit"
          @control="chart?.animation[$event]()"
          @scenario="scenario"
          @replay="replayEntrance"
        />
        <ConfigPanel
          v-if="chart"
          :options="options"
          :series="series"
          :empty="empty"
          @field="edit"
          @series="updateSeries"
          @mode="mode"
          @empty="empty = $event"
        />
      </aside>
      <section class="preview-pane" aria-labelledby="page-title">
        <header class="preview-pane__header"><h1 id="page-title">波形图预览</h1></header>
        <Alert v-if="error" :message="error" type="error" role="alert" />
        <div class="preview-stage">
          <WaveformPreview
            :data="previewData"
            :options="previewOptions"
            @ready="ready"
            @error="error = $event.message"
          />
        </div>
      </section>
    </main>
  </ConfigProvider>
</template>

<script setup lang="ts">
import { tabKeyboard } from '../../composables/tabKeyboard'
import { computed, reactive, ref } from 'vue'
import { Tabs, TabPane, Segmented, Select } from 'ant-design-vue'
import type { WaveformOptions, WaveformSeries } from 'waveform-analysis/display'
import { tabs, axisFields, type FieldDefinition } from '../../config/fields'
import ConfigField from './ConfigField.vue'
import OptionsForm from './OptionsForm.vue'
import SeriesForm from './SeriesForm.vue'
const props = defineProps<{ options: WaveformOptions; series: WaveformSeries[]; empty?: boolean }>()
const emit = defineEmits<{
  field: [path: string, value: unknown]
  series: [series: WaveformSeries[]]
  mode: [mode: 'single' | 'multiple']
  empty: [value: boolean]
}>()
const active = ref('layout'),
  selectedAxis = ref(0)
const subsections = reactive(
  Object.fromEntries(tabs.map((tab) => [tab.id, tab.subsections?.[0]?.id])),
)
const current = computed(() => tabs.find((tab) => tab.id === active.value)!)
const section = computed(() =>
  current.value.subsections?.find((section) => section.id === subsections[active.value]),
)
const multiple = computed(() => (props.options.yAxes?.length ?? 0) > 1)
const fields = computed(() => {
  if (section.value?.id === 'value-y')
    return axisFields(
      `yAxes.${Math.min(selectedAxis.value, (props.options.yAxes?.length ?? 1) - 1)}`,
      false,
    )
  return (section.value?.fields ?? [])
    .filter((field) => multiple.value || !['grid.y.axisId', 'zeroLine.axisId'].includes(field.path))
    .map((field) =>
      ['grid.y.axisId', 'zeroLine.axisId'].includes(field.path)
        ? {
            ...field,
            options: props.options.yAxes?.map((axis) => ({
              label: axis.position === 'right' ? '右轴' : '左轴',
              value: axis.id,
            })),
          }
        : field,
    )
})
const emptyField: FieldDefinition = { kind: 'boolean', label: '预览空数据状态', path: 'empty' }
</script>
<template>
  <div class="config-panel">
    <div class="config-panel__heading"><h2>实时配置</h2></div>
    <Tabs @keydown="tabKeyboard" v-model:activeKey="active" size="small" class="config-tabs"
      ><TabPane v-for="tab in tabs" :key="tab.id" :tab="tab.label"
    /></Tabs>
    <div class="config-tabpanel">
      <KeepAlive
        ><SeriesForm
          v-if="current.series"
          :series="series"
          :options="options"
          @change="emit('series', $event)"
      /></KeepAlive>
      <template v-if="!current.series">
        <Segmented
          v-if="current.subsections"
          v-model:value="subsections[active]"
          block
          :options="current.subsections.map((entry) => ({ label: entry.label, value: entry.id }))"
        />
        <div v-if="section?.id === 'value-y'" class="axis-toolbar">
          <Segmented
            :value="multiple ? 'multiple' : 'single'"
            block
            aria-label="值轴模式"
            :options="[
              { label: '单值轴', value: 'single' },
              { label: '多值轴', value: 'multiple' },
            ]"
            @change="
              (value) => {
                selectedAxis = 0
                emit('mode', value as 'single' | 'multiple')
              }
            "
          />
          <Select
            v-if="multiple"
            v-model:value="selectedAxis"
            aria-label="选择值轴"
            :options="
              options.yAxes?.map((axis, i) => ({
                label: axis.position === 'right' ? '右轴' : '左轴',
                value: i,
              }))
            "
          />
        </div>
        <ConfigField
          v-if="section?.id === 'empty'"
          :field="emptyField"
          :value="empty"
          @change="emit('empty', Boolean($event))"
        />
        <OptionsForm
          :fields="fields"
          :options="options"
          @field="(path, value) => emit('field', path, value)"
        />
      </template>
    </div>
  </div>
</template>

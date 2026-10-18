<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Checkbox, Segmented, Select, Empty } from 'ant-design-vue'
import type { WaveformOptions, WaveformSeries } from 'waveform-analysis/display'
import { getAtPath, setAtPath } from '../../config/fields'
import { seriesFields } from '../../config/seriesFields'
import ConfigField from './ConfigField.vue'
const props = defineProps<{ series: WaveformSeries[]; options: WaveformOptions }>()
const emit = defineEmits<{ change: [series: WaveformSeries[]] }>()
const selected = ref(0),
  category = ref<'line' | 'point'>('line')
watch(
  () => props.series.length,
  (length) => {
    selected.value = Math.max(0, Math.min(selected.value, length - 1))
  },
  { flush: 'sync' },
)
const index = computed(() => Math.min(selected.value, props.series.length - 1))
const item = computed(() => props.series[index.value])
function update(path: string, value: unknown) {
  emit(
    'change',
    props.series.map((series, i) => (i === index.value ? setAtPath(series, path, value) : series)),
  )
}
</script>
<template>
  <Empty v-if="!item" description="暂无曲线" />
  <template v-else>
    <div class="series-toolbar">
      <div class="series-selector">
        <span>当前曲线</span
        ><Select
          v-model:value="selected"
          aria-label="选择曲线"
          :options="
            series.map((series, i) => ({
              label: series.name || series.id || `曲线 ${i + 1}`,
              value: i,
            }))
          "
        />
      </div>
      <div v-if="(options.yAxes?.length ?? 0) > 1" class="series-selector">
        <span>坐标轴</span
        ><Select
          :value="item.yAxis ?? options.yAxes?.[0].id"
          aria-label="坐标轴"
          :options="
            options.yAxes?.map((axis) => ({
              label: axis.position === 'right' ? '右轴' : '左轴',
              value: axis.id,
            }))
          "
          @update:value="update('yAxis', $event)"
        />
      </div>
    </div>
    <Segmented
      v-model:value="category"
      block
      aria-label="曲线样式类型"
      :options="[
        { label: '线条', value: 'line' },
        { label: '数据点', value: 'point' },
      ]"
    />
    <div class="series-overrides">
      <div
        v-for="field in seriesFields.filter((field) => field.category === category)"
        :key="field.path"
        class="series-override"
      >
        <div class="series-override__heading">
          <span>{{ field.label }}</span
          ><Checkbox
            class="inherit-toggle"
            :checked="getAtPath(item, field.path) === undefined"
            :aria-label="`${field.label}跟随全局`"
            @update:checked="
              update(field.path, $event ? undefined : getAtPath(options, field.inherited))
            "
            >跟随全局</Checkbox
          >
        </div>
        <ConfigField
          :field="field"
          :value="getAtPath(item, field.path) ?? getAtPath(options, field.inherited)"
          :disabled="getAtPath(item, field.path) === undefined"
          @change="update(field.path, $event)"
        />
      </div>
    </div>
  </template>
</template>

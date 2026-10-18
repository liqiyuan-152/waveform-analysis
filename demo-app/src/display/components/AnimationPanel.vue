<script setup lang="ts">
import { tabKeyboard } from '../composables/tabKeyboard'
import { ref } from 'vue'
import { Button, Switch, Tabs, TabPane } from 'ant-design-vue'
import type { WaveformOptions } from 'waveform-analysis/display'
import OptionsForm from './config-panel/OptionsForm.vue'
import type { FieldDefinition } from '../config/fields'
defineProps<{ options: WaveformOptions; replayDisabled?: boolean; appendDisabled?: boolean }>()
const emit = defineEmits<{
  field: [path: string, value: unknown]
  control: [action: 'pause' | 'resume' | 'finish']
  scenario: [name: 'append' | 'window' | 'domain' | 'extreme' | 'auto-padding']
  replay: []
}>()
const active = ref('entrance')
const entrance: FieldDefinition[] = [
  { kind: 'boolean', label: '入场动画', path: 'animation.enabled' },
  {
    kind: 'select',
    label: '入场方向',
    path: 'animation.direction',
    options: [
      { label: '从左到右', value: 'left-to-right' },
      { label: '从右到左', value: 'right-to-left' },
      { label: '从中心展开', value: 'center-out' },
    ],
  },
  { kind: 'number', label: '入场时长（ms）', path: 'animation.duration', min: 0 },
  { kind: 'number', label: '入场延迟（ms）', path: 'animation.delay', min: 0 },
  { kind: 'number', label: '错峰间隔（ms）', path: 'animation.staggerDelay', min: 0 },
]
const update: FieldDefinition[] = [
  { kind: 'boolean', label: '更新动画', path: 'animationUpdate.enabled' },
  { kind: 'number', label: '更新时长（ms）', path: 'animationUpdate.duration', min: 0 },
  {
    kind: 'select',
    label: '更新缓动',
    path: 'animationUpdate.easing',
    options: [
      { label: '平滑加减速', value: 'cubicInOut' },
      { label: '匀速', value: 'linear' },
    ],
  },
]
const scenarios = [
  { label: '追加点', value: 'append' },
  { label: '滑动窗口', value: 'window' },
  { label: '坐标域变化', value: 'domain' },
  { label: '极端位移', value: 'extreme' },
  { label: '自动留白变化', value: 'auto-padding' },
] as const
</script>
<template>
  <section class="animation-panel" aria-label="动画与数据更新">
    <div class="config-panel__heading">
      <h2>动画与数据更新</h2>
      <div class="animation-toggle">
        <span>启用动画</span
        ><Switch
          :checked="options.animationEnabled"
          aria-label="启用动画（影响后续数据更新）"
          @update:checked="emit('field', 'animationEnabled', $event)"
        />
      </div>
    </div>
    <Tabs @keydown="tabKeyboard" v-model:activeKey="active" size="small" class="config-tabs">
      <TabPane key="entrance" tab="入场动画" /><TabPane key="update" tab="更新动画" /><TabPane
        key="scenarios"
        tab="数据场景"
      />
    </Tabs>
    <div class="animation-content">
      <template v-if="active === 'entrance'">
        <OptionsForm
          :fields="entrance"
          :options="options"
          @field="(path, value) => emit('field', path, value)"
        />
        <Button
          :disabled="replayDisabled || !options.animationEnabled || !options.animation?.enabled"
          @click="emit('replay')"
          >重播入场</Button
        >
      </template>
      <OptionsForm
        v-else-if="active === 'update'"
        :fields="update"
        :options="options"
        @field="(path, value) => emit('field', path, value)"
      />
      <div v-else class="scenario-buttons">
        <Button
          v-for="item in scenarios"
          :key="item.value"
          :disabled="item.value === 'append' && appendDisabled"
          @click="emit('scenario', item.value)"
          >{{ item.label }}</Button
        >
      </div>
      <div class="animation-actions" role="group" aria-label="动画控制">
        <Button @click="emit('control', 'pause')">暂停</Button
        ><Button @click="emit('control', 'resume')">恢复</Button
        ><Button @click="emit('control', 'finish')">结束动画</Button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { InputNumber, Switch } from 'ant-design-vue'
import type { DemoControlPanelModel } from './types'
const model = defineModel<DemoControlPanelModel>('model', { required: true })
</script>

<template>
  <section class="control-section">
    <h2>Y 轴留白</h2>
    <div v-for="side in ['upper', 'lower'] as const" :key="side" class="y-axis-padding-control">
      <span>{{ side === 'upper' ? '上方留白' : '下方留白' }}</span>
      <Switch
        v-model:checked="model[`${side}PaddingEnabled`]"
        size="small"
        :aria-label="side === 'upper' ? '上方留白' : '下方留白'"
      />
      <InputNumber
        v-model:value="model[`${side}PaddingPercent`]"
        :min="0"
        :step="1"
        :disabled="!model[`${side}PaddingEnabled`]"
        addon-after="%"
        size="small"
        :aria-label="side === 'upper' ? '上方留白比例' : '下方留白比例'"
      />
    </div>
    <small>仅作用于自动 Y 范围；刻度取整可能增加实际留白。</small>
  </section>
</template>

<style scoped>
.y-axis-padding-control {
  display: grid;
  grid-template-columns: 60px 28px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
}
.y-axis-padding-control :deep(.ant-switch) {
  justify-self: start;
}
.y-axis-padding-control :deep(.ant-input-number) {
  width: 100%;
}
</style>

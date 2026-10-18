<script setup lang="ts">
import { Checkbox, InputNumber, Select, Switch } from 'ant-design-vue'
import type { DemoControlPanelModel } from './types'
import { defaultToolbarItems, toolbarLabels } from './toolbarOptions'

const model = defineModel<DemoControlPanelModel>('model', { required: true })
const positions = [
  { label: '左上', value: 'top-left' },
  { label: '右上', value: 'top-right' },
  { label: '左下', value: 'bottom-left' },
  { label: '右下', value: 'bottom-right' },
]
const buttons = defaultToolbarItems.map((id) => ({ label: toolbarLabels[id], value: id }))
</script>

<template>
  <section class="control-section toolbar-controls" aria-label="工具栏配置">
    <div class="control-section__header">
      <h2>工具栏</h2>
      <Switch v-model:checked="model.toolbarVisible" size="small" aria-label="显示内置工具栏" />
    </div>
    <div class="auxiliary-style-controls toolbar-controls__fields">
      <label class="frame-style-control">
        <span>工具栏位置</span>
        <Select
          v-model:value="model.toolbarPosition"
          :options="positions"
          size="small"
          aria-label="工具栏位置"
        />
      </label>
      <label class="frame-style-control">
        <span>水平偏移</span>
        <InputNumber
          v-model:value="model.toolbarOffsetX"
          addon-after="px"
          size="small"
          aria-label="工具栏水平偏移"
        />
      </label>
      <label class="frame-style-control">
        <span>垂直偏移</span>
        <InputNumber
          v-model:value="model.toolbarOffsetY"
          addon-after="px"
          size="small"
          aria-label="工具栏垂直偏移"
        />
      </label>
    </div>
    <p class="toolbar-controls__hint">负数向左 / 上，正数向右 / 下</p>
    <div class="toolbar-controls__buttons">
      <span>显示按钮</span>
      <Checkbox.Group
        v-model:value="model.toolbarItems"
        :options="buttons"
        aria-label="工具栏按钮"
      />
    </div>
  </section>
</template>

<style scoped>
.toolbar-controls__fields {
  margin-top: 12px;
}
.toolbar-controls__hint {
  margin: 8px 0 0;
  color: var(--demo-muted);
  font-size: 12px;
}
.toolbar-controls__buttons {
  display: grid;
  gap: 8px;
  margin-top: 16px;
  color: var(--demo-muted);
  font-size: 12px;
}
.toolbar-controls__buttons :deep(.ant-checkbox-group) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}
.toolbar-controls__buttons :deep(.ant-checkbox-wrapper) {
  margin: 0;
  white-space: nowrap;
  font-size: 12px;
}
</style>

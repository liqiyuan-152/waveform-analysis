<script setup lang="ts">
import { Button, InputNumber, Radio, Select, Switch } from 'ant-design-vue'

import type { DemoControlPanelModel } from './types'

const model = defineModel<DemoControlPanelModel>('model', { required: true })
</script>

<template>
  <section class="control-section">
    <h2>显示方式</h2>
    <Radio.Group
      v-model:value="model.displayMode"
      class="display-mode-control"
      button-style="solid"
      size="small"
      aria-label="波形展示方式"
    >
      <Radio.Button value="independent">单独坐标</Radio.Button>
      <Radio.Button value="separated">多道分离</Radio.Button>
      <Radio.Button value="compact">多道紧凑</Radio.Button>
    </Radio.Group>
  </section>
  <section class="control-section">
    <h2>叠加方式</h2>
    <Radio.Group
      v-model:value="model.overlayMode"
      class="display-mode-control"
      button-style="solid"
      size="small"
      aria-label="波形叠加方式"
    >
      <Radio.Button value="single-axis">单值轴</Radio.Button>
      <Radio.Button value="multi-axis">多值轴</Radio.Button>
    </Radio.Group>
  </section>
  <section class="control-section">
    <h2>视图</h2>
    <Button block aria-label="重置波形视图" @click="model.resetWaveformViewport"> 重置视图 </Button>
    <div class="auxiliary-style-controls" style="margin-top: 10px">
      <label class="frame-style-control frame-style-control--switch">
        <span>数值 Tooltip</span>
        <Switch v-model:checked="model.showTooltip" size="small" aria-label="显示数值 Tooltip" />
      </label>
      <label class="frame-style-control frame-style-control--switch">
        <span>净图</span>
        <Switch v-model:checked="model.cleanView" size="small" aria-label="净图模式" />
      </label>
    </div>
  </section>
  <section class="control-section">
    <h2>波形线型</h2>
    <label class="select-control">
      <span>波形</span>
      <Select
        v-model:value="model.selectedSeriesId"
        :options="model.seriesStyleOptions"
        size="small"
        aria-label="选择波形线型"
      />
    </label>
    <label class="select-control">
      <span>线型</span>
      <Select
        v-model:value="model.selectedLineStyle"
        :options="model.lineStyleOptions"
        size="small"
        aria-label="设置波形线型"
      />
    </label>
  </section>
  <section class="control-section">
    <h2>图框布局</h2>
    <div class="grid-size-control" aria-label="波形网格尺寸">
      <InputNumber v-model:value="model.rowCount" :min="1" :max="10" size="small" />
      <span>行</span>
      <span class="control-separator">×</span>
      <InputNumber v-model:value="model.columnCount" :min="1" :max="10" size="small" />
      <span>列</span>
    </div>
  </section>
</template>

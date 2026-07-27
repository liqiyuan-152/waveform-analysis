<script setup lang="ts">
import { InputNumber, Select, Switch } from 'ant-design-vue'
import { ColorPicker } from 'vue3-colorpicker'

import type { DemoControlPanelModel } from './types'

const model = defineModel<DemoControlPanelModel>('model', { required: true })
</script>

<template>
  <section class="control-section">
    <div class="control-section__header">
      <h2>零值参考线</h2>
      <Switch v-model:checked="model.zeroLineVisible" size="small" aria-label="显示零值参考线" />
    </div>
    <div class="auxiliary-style-controls zero-line-controls" style="margin-top: 10px">
      <label class="frame-style-control">
        <span>颜色</span>
        <ColorPicker
          v-model:pure-color="model.zeroLineColor"
          aria-label="零值参考线颜色"
          use-type="pure"
          picker-type="chrome"
          format="hex"
          :disable-alpha="true"
          :blur-close="true"
        />
      </label>
      <label class="frame-style-control">
        <span>线宽</span>
        <InputNumber
          v-model:value="model.zeroLineWidth"
          :min="0.5"
          :max="10"
          :step="0.5"
          size="small"
          aria-label="零值参考线线宽"
        />
      </label>
      <label class="frame-style-control">
        <span>线型</span>
        <Select
          v-model:value="model.zeroLineDash"
          :options="model.zeroLineDashOptions"
          size="small"
          aria-label="零值参考线线型"
        />
      </label>
    </div>
  </section>
  <section class="control-section">
    <h2>网格与轴线</h2>
    <div class="grid-line-controls">
      <div class="grid-line-control">
        <span>水平网格</span>
        <Switch
          v-model:checked="model.horizontalGridVisible"
          size="small"
          aria-label="显示水平网格线"
        />
        <span class="grid-line-color-picker" role="group" aria-label="水平网格线颜色">
          <ColorPicker
            v-model:pure-color="model.horizontalGridColor"
            use-type="pure"
            picker-type="chrome"
            format="hex"
            :disable-alpha="true"
            :blur-close="true"
          />
        </span>
      </div>
      <div class="grid-line-control">
        <span>垂直网格</span>
        <Switch
          v-model:checked="model.verticalGridVisible"
          size="small"
          aria-label="显示垂直网格线"
        />
        <span class="grid-line-color-picker" role="group" aria-label="垂直网格线颜色">
          <ColorPicker
            v-model:pure-color="model.verticalGridColor"
            use-type="pure"
            picker-type="chrome"
            format="hex"
            :disable-alpha="true"
            :blur-close="true"
          />
        </span>
      </div>
      <div class="grid-line-control grid-line-control--switch-only">
        <span>横轴线</span>
        <Switch v-model:checked="model.xAxisLineVisible" size="small" aria-label="显示横轴线" />
      </div>
      <div class="grid-line-control grid-line-control--switch-only">
        <span>纵轴线</span>
        <Switch v-model:checked="model.yAxisLineVisible" size="small" aria-label="显示纵轴线" />
      </div>
    </div>
  </section>
  <section class="control-section">
    <h2>图框样式</h2>
    <div class="frame-style-controls">
      <label class="frame-style-control">
        <span>边框颜色</span>
        <ColorPicker
          v-model:pure-color="model.frameBorderColor"
          aria-label="图框边框颜色"
          use-type="pure"
          picker-type="chrome"
          format="rgb"
          :disable-alpha="false"
          :blur-close="true"
        />
      </label>
      <label class="frame-style-control">
        <span>背景颜色</span>
        <ColorPicker
          v-model:pure-color="model.frameBackgroundColor"
          aria-label="图框背景颜色"
          use-type="pure"
          picker-type="chrome"
          format="rgb"
          :disable-alpha="false"
          :blur-close="true"
        />
      </label>
      <label class="frame-style-control">
        <span>线宽</span>
        <InputNumber
          v-model:value="model.frameBorderWidth"
          :min="0"
          :max="10"
          :step="0.5"
          size="small"
          aria-label="图框线宽"
        />
      </label>
      <label class="frame-style-control">
        <span>线型</span>
        <Select
          v-model:value="model.frameBorderStyle"
          :options="model.frameBorderStyleOptions"
          size="small"
          aria-label="图框线型"
        />
      </label>
      <label class="frame-style-control frame-style-control--switch">
        <span>水印</span>
        <Switch
          v-model:checked="model.frameWatermarkVisible"
          size="small"
          aria-label="显示图框水印"
        />
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Input, InputNumber, Select, Switch } from 'ant-design-vue'
import { ColorPicker } from 'vue3-colorpicker'

import type { DemoControlPanelModel } from './types'

const model = defineModel<DemoControlPanelModel>('model', { required: true })
</script>

<template>
  <section class="control-section title-control-section">
    <div class="control-section__header">
      <h2>标题</h2>
      <Switch v-model:checked="model.titleVisible" size="small" aria-label="显示标题" />
    </div>
    <div class="title-controls">
      <label class="title-control title-control--wide">
        <span>标题名称</span>
        <Input v-model:value="model.titleText" size="small" aria-label="标题名称" />
      </label>
      <label class="title-control title-control--wide">
        <span>对齐方式</span>
        <Select
          v-model:value="model.titleAlign"
          :options="model.titleAlignOptions"
          size="small"
          aria-label="标题对齐方式"
        />
      </label>
      <label class="title-control">
        <span>字体</span>
        <Select
          v-model:value="model.titleFontFamily"
          :options="model.titleFontFamilyOptions"
          size="small"
          aria-label="标题字体"
        />
      </label>
      <label class="title-control">
        <span>字号</span>
        <InputNumber
          v-model:value="model.titleFontSize"
          :min="8"
          :max="72"
          :step="1"
          size="small"
          aria-label="标题字号"
        />
      </label>
      <div class="title-control">
        <span>字体样式</span>
        <div class="title-style-controls" role="group" aria-label="标题字体样式">
          <button
            type="button"
            aria-label="恢复标题常规样式"
            title="恢复常规样式"
            @click="model.resetTitleTextStyle"
          >
            A
          </button>
          <button
            type="button"
            :class="{ 'is-active': model.titleBold }"
            :aria-pressed="model.titleBold"
            aria-label="标题粗体"
            title="粗体"
            @click="model.titleBold = !model.titleBold"
          >
            <b>B</b>
          </button>
          <button
            type="button"
            :class="{ 'is-active': model.titleItalic }"
            :aria-pressed="model.titleItalic"
            aria-label="标题斜体"
            title="斜体"
            @click="model.titleItalic = !model.titleItalic"
          >
            <i>I</i>
          </button>
          <button
            type="button"
            :class="{ 'is-active': model.titleUnderline }"
            :aria-pressed="model.titleUnderline"
            aria-label="标题下划线"
            title="下划线"
            @click="model.titleUnderline = !model.titleUnderline"
          >
            <u>U</u>
          </button>
        </div>
      </div>
      <label class="title-control">
        <span>旋转</span>
        <InputNumber
          v-model:value="model.titleRotation"
          :min="-180"
          :max="180"
          :step="1"
          addon-after="°"
          size="small"
          aria-label="标题旋转角度"
        />
      </label>
      <div class="title-control title-control--color">
        <span>颜色</span>
        <ColorPicker
          v-model:pure-color="model.titleColor"
          aria-label="标题颜色"
          use-type="pure"
          picker-type="chrome"
          format="hex"
          :disable-alpha="true"
          :blur-close="true"
        />
      </div>
    </div>
  </section>
  <section class="control-section">
    <h2>图例</h2>
    <label class="select-control">
      <span>位置</span>
      <Select
        v-model:value="model.legendPosition"
        :options="model.legendPositionOptions"
        size="small"
        aria-label="图例位置"
      />
    </label>
    <label class="select-control">
      <span>排列</span>
      <Select
        v-model:value="model.legendOrientation"
        :options="model.legendOrientationOptions"
        size="small"
        aria-label="图例排列"
      />
    </label>
    <label class="legend-color-control">
      <span>背景</span>
      <ColorPicker
        v-model:pure-color="model.legendBackgroundColor"
        aria-label="图例背景颜色"
        use-type="pure"
        picker-type="chrome"
        format="rgb"
        :disable-alpha="false"
        :blur-close="true"
      />
    </label>
  </section>
</template>

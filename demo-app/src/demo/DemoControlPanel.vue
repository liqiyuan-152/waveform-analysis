<script setup lang="ts">
import { Button } from 'ant-design-vue'

import DemoGridFrameControls from './DemoGridFrameControls.vue'
import DemoTitleLegendControls from './DemoTitleLegendControls.vue'
import DemoViewControls from './DemoViewControls.vue'
import type { DemoControlPanelModel } from './types'

const model = defineModel<DemoControlPanelModel>('model', { required: true })
</script>

<template>
  <Button
    class="mobile-control-toggle"
    size="small"
    :aria-expanded="model.controlsOpen"
    aria-controls="waveform-control-panel"
    @click="model.controlsOpen = true"
  >
    控制面板
  </Button>
  <button
    v-if="model.controlsOpen"
    type="button"
    class="control-backdrop"
    aria-label="关闭控制面板"
    @click="model.closeControls"
  />
  <aside
    id="waveform-control-panel"
    class="control-panel"
    :class="{ 'is-open': model.controlsOpen }"
    aria-label="波形图控制"
  >
    <div class="control-panel__scroll">
      <Button class="control-panel__close" type="text" size="small" @click="model.closeControls">
        关闭
      </Button>
      <DemoViewControls :model="model" />
      <DemoGridFrameControls :model="model" />
      <DemoTitleLegendControls :model="model" />
    </div>
  </aside>
</template>

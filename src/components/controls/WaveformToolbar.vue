<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { WaveformChartController } from '../core/useWaveformChartController'
import { resolveToolbar } from './toolbarRegistry'
import { useToolbarPosition } from './useToolbarPosition'
const props = defineProps<{ controller: WaveformChartController }>()
const config = computed(() => resolveToolbar(props.controller.toolbar))
const compact = computed(() => props.controller.chartWidth < 440)
const expanded = ref(false)
const toolbarElement = ref<HTMLElement>()
const menuElement = ref<HTMLElement>()
const positionStyle = useToolbarPosition(
  toolbarElement,
  () => props.controller,
  config,
  menuElement,
)
const menu = ref(false)
const busy = ref(false)
const feedback = ref('')
let disposed = false
onBeforeUnmount(() => {
  disposed = true
})
watch(
  [
    () => config.value.visible,
    () => config.value.groups.flat().some((item) => item.id === 'export'),
  ],
  () => {
    menu.value = false
  },
)
async function download(format: 'png' | 'svg') {
  menu.value = false
  busy.value = true
  feedback.value = ''
  try {
    const blob = await props.controller.exportImage({ format })
    if (disposed) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    try {
      link.href = url
      link.download = `waveform.${format}`
      document.body.appendChild(link)
      link.click()
    } finally {
      link.remove()
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    if (!disposed) feedback.value = error instanceof Error ? error.message : '导出失败，请重试'
  } finally {
    busy.value = false
  }
}
function toggleExpanded() {
  expanded.value = !expanded.value
  menu.value = false
}
function escape() {
  menu.value = false
  expanded.value = false
  props.controller.cancelViewportDrag()
}
</script>
<template>
  <div
    v-if="config.visible"
    ref="toolbarElement"
    class="waveform-toolbar"
    :class="[
      `waveform-toolbar--${config.display}`,
      `waveform-toolbar--${config.position}`,
      { 'waveform-toolbar--collapsed': compact && !expanded },
    ]"
    :style="positionStyle"
    role="toolbar"
    aria-label="波形工具栏"
    @pointerdown.stop
    @click.stop
    @dblclick.stop
    @wheel.stop
    @contextmenu.stop
    @keydown.esc.stop="escape"
  >
    <button
      v-if="compact"
      type="button"
      class="waveform-toolbar__toggle"
      aria-label="图表工具"
      :aria-expanded="expanded"
      @click="toggleExpanded"
    >
      工具
    </button>
    <div
      v-for="(group, index) in config.groups"
      :key="index"
      class="waveform-toolbar__group"
      :data-group="group[0]?.group"
    >
      <button
        v-for="item in group"
        :key="item.id"
        type="button"
        :data-command="item.id"
        :title="item.label"
        :aria-label="item.label"
        :aria-pressed="item.group === 'mode' ? item.active(controller.controlState) : undefined"
        :aria-expanded="item.id === 'export' ? menu : undefined"
        :disabled="!item.enabled(controller.controlState) || (item.id === 'export' && busy)"
        @click="item.id === 'export' ? (menu = !menu) : item.run(controller)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon" /></svg>
      </button>
    </div>
    <div
      v-if="menu"
      ref="menuElement"
      class="waveform-toolbar__menu"
      role="group"
      aria-label="图片格式"
    >
      <button type="button" @click="download('png')">下载 PNG</button>
      <button type="button" @click="download('svg')">下载 SVG</button>
    </div>
    <span v-if="busy || feedback" class="waveform-toolbar__feedback" role="status">{{
      busy ? '正在导出…' : feedback
    }}</span>
  </div>
</template>
<style scoped>
.waveform-toolbar {
  position: absolute;
  z-index: 10;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  width: max-content;
  max-width: calc(100% - 4px);
  background: transparent;
}
.waveform-toolbar--collapsed > :not(.waveform-toolbar__toggle):not(.waveform-toolbar__feedback) {
  display: none;
}

.waveform-toolbar--hover {
  opacity: 0;
  pointer-events: none;
}
.waveform-chart:hover .waveform-toolbar--hover,
.waveform-toolbar:focus-within,
.waveform-toolbar:has(.waveform-toolbar__menu),
.waveform-toolbar:has(.waveform-toolbar__feedback) {
  opacity: 1;
  pointer-events: auto;
}
.waveform-toolbar__group {
  display: flex;
  flex-wrap: wrap;
  padding: 3px 4px;
}
.waveform-toolbar__group,
.waveform-toolbar__toggle,
.waveform-toolbar__feedback {
  background: rgb(255 255 255 / 45%);
  border: 1px solid rgb(152 162 179 / 45%);
  border-radius: 6px;
  box-shadow: 0 1px 4px rgb(16 24 40 / 6%);
}
.waveform-toolbar__toggle {
  min-height: 30px;
  padding-inline: 8px;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 24px;
  height: 22px;
  padding: 3px 4px;
  font-size: 12px;
  line-height: normal;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #344054;
  cursor: pointer;
}
button:hover,
button[aria-pressed='true'] {
  background: rgb(186 224 255 / 50%);
  color: #0960bd;
}
button:disabled {
  opacity: 0.35;
  cursor: default;
}
button:focus-visible {
  outline: 2px solid #0960bd;
  outline-offset: 1px;
}
svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.waveform-toolbar__menu {
  position: absolute;
  right: 0;
  top: 100%;
  padding: 6px;
  border: 1px solid #d0d5dd;
  border-radius: 4px;
  background: white;
  display: flex;
}
.waveform-toolbar--top-left .waveform-toolbar__menu,
.waveform-toolbar--bottom-left .waveform-toolbar__menu {
  left: 0;
  right: auto;
}
.waveform-toolbar--bottom-left .waveform-toolbar__menu,
.waveform-toolbar--bottom-right .waveform-toolbar__menu {
  top: auto;
  bottom: 100%;
}
.waveform-toolbar__feedback {
  flex-basis: 100%;
  padding: 4px 6px;
  font-size: 12px;
  max-width: 300px;
}
@media (hover: none) {
  .waveform-toolbar--hover {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>

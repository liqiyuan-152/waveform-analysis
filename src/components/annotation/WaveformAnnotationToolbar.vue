<script setup lang="ts">
import type { WaveformInteractionMode } from '../../types'

interface Props {
  interactionMode?: WaveformInteractionMode
  annotationsVisible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'update:interaction-mode', mode: WaveformInteractionMode): void
  (event: 'update:annotations-visible', visible: boolean): void
}>()
</script>

<template>
  <div class="waveform-annotation-toolbar" role="toolbar" aria-label="波形标注工具">
    <button
      type="button"
      :class="{ 'is-active': props.interactionMode === 'zoom' }"
      aria-label="缩放模式"
      title="缩放模式"
      @click="emit('update:interaction-mode', 'zoom')"
    >
      缩放
    </button>
    <button
      type="button"
      :class="{ 'is-active': props.interactionMode === 'annotation' }"
      aria-label="添加标注"
      title="添加标注"
      @click="emit('update:interaction-mode', 'annotation')"
    >
      标注
    </button>
    <button
      type="button"
      :class="{ 'is-active': props.annotationsVisible }"
      :aria-pressed="props.annotationsVisible"
      :aria-label="props.annotationsVisible ? '隐藏标注' : '显示标注'"
      title="显示/隐藏标注"
      @click="emit('update:annotations-visible', !props.annotationsVisible)"
    >
      {{ props.annotationsVisible ? '隐藏' : '显示' }}
    </button>
  </div>
</template>

<style scoped>
.waveform-annotation-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  display: flex;
  gap: 4px;
  padding: 5px;
  background: #fff;
  border: 1px solid #dfe5ef;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.waveform-annotation-toolbar button {
  min-width: 42px;
  height: 28px;
  padding: 0 7px;
  color: #667085;
  font-size: 12px;
  background: transparent;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}

.waveform-annotation-toolbar button:hover,
.waveform-annotation-toolbar button.is-active {
  color: #1677ff;
  background: #e6f4ff;
}
</style>

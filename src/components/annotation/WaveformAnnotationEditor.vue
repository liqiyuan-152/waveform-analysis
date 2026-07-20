<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, useId, watch } from 'vue'

import type { WaveformAnnotation } from '../../types'
import { formatAnnotationTime, formatPlainNumber, type TimeUnit } from '../../utils'
import { ANNOTATION_MAX_TEXT_LENGTH, resolveAnnotationStyle } from './markup'
import type { AnnotationSeriesCandidate, AnnotationSeriesInfo } from './types'

const ColorPicker = defineAsyncComponent(async () => {
  await import('vue3-colorpicker/style.css')
  return (await import('vue3-colorpicker')).ColorPicker
})

interface Props {
  annotation: WaveformAnnotation
  mode: 'add' | 'edit'
  series?: AnnotationSeriesInfo
  seriesOptions?: AnnotationSeriesCandidate[]
  timeUnit?: TimeUnit
}

const props = withDefaults(defineProps<Props>(), {
  timeUnit: 'ms',
})
const emit = defineEmits<{
  (event: 'confirm', annotation: WaveformAnnotation): void
  (event: 'cancel'): void
  (event: 'series-change', seriesId: string): void
}>()

const textarea = ref<HTMLTextAreaElement>()
const dialogTitleId = `waveform-annotation-editor-title-${useId()}`
const text = ref('')
const borderColor = ref('')
const textColor = ref('')
const backgroundColor = ref('')
const canConfirm = computed(() => text.value.trim().length > 0)
const characterCount = computed(() => text.value.length)
const selectedSeries = computed(() => {
  const option = props.seriesOptions?.find(
    (candidate) => candidate.seriesId === props.annotation.seriesId,
  )
  return option
    ? { id: option.seriesId, name: option.name, color: option.color, unit: option.unit }
    : props.series
})

function hydrate() {
  const style = resolveAnnotationStyle(props.annotation.style)
  text.value = props.annotation.text
  borderColor.value = style.borderColor
  textColor.value = style.textColor
  backgroundColor.value = style.backgroundColor
  void nextTick(() => textarea.value?.focus())
}

watch(() => props.annotation, hydrate, { immediate: true })

function confirm() {
  if (!canConfirm.value) return
  emit('confirm', {
    ...props.annotation,
    text: text.value.trim(),
    style: {
      borderColor: borderColor.value,
      textColor: textColor.value,
      backgroundColor: backgroundColor.value.trim() || 'rgba(255, 255, 255, 0.92)',
    },
  })
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cancel')
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    confirm()
  }
}

function handleSeriesChange(event: Event) {
  const select = event.target as HTMLSelectElement
  if (select.value) emit('series-change', select.value)
}
</script>

<template>
  <div
    class="waveform-annotation-editor"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="dialogTitleId"
    @click.self="emit('cancel')"
  >
    <section class="waveform-annotation-editor__panel">
      <header class="waveform-annotation-editor__header">
        <div>
          <h2 :id="dialogTitleId">
            {{ props.mode === 'add' ? '添加标注' : '编辑标注' }}
          </h2>
        </div>
        <button
          type="button"
          class="waveform-annotation-editor__close"
          aria-label="关闭标注编辑器"
          title="关闭"
          @click="emit('cancel')"
        >
          ×
        </button>
      </header>

      <div class="waveform-annotation-editor__coordinates" aria-label="标注坐标">
        <span
          ><b>X ({{ props.timeUnit }})</b
          ><code>{{ formatAnnotationTime(props.annotation.x, props.timeUnit) }}</code></span
        >
        <span
          ><b>Y</b><code>{{ formatPlainNumber(props.annotation.y) }}</code></span
        >
      </div>

      <label
        v-if="selectedSeries"
        class="waveform-annotation-editor__series"
        aria-label="标注所属波形"
      >
        <i :style="{ backgroundColor: selectedSeries.color }" aria-hidden="true" />
        <span class="waveform-annotation-editor__series-label">
          <small>标注波形</small>
          <b>{{ selectedSeries.name }}</b>
        </span>
        <select
          v-if="props.seriesOptions?.length"
          :value="props.annotation.seriesId"
          aria-label="选择标注波形"
          @change="handleSeriesChange"
        >
          <option
            v-for="candidate in props.seriesOptions"
            :key="candidate.seriesId"
            :value="candidate.seriesId"
          >
            {{ candidate.name }}{{ candidate.unit ? ` (${candidate.unit})` : '' }}
          </option>
        </select>
        <code v-else-if="selectedSeries.unit">{{ selectedSeries.unit }}</code>
      </label>

      <label class="waveform-annotation-editor__field">
        <span class="waveform-annotation-editor__label-row">
          <b>标注文本</b>
          <small>{{ characterCount }}/{{ ANNOTATION_MAX_TEXT_LENGTH }}</small>
        </span>
        <textarea
          ref="textarea"
          v-model="text"
          rows="4"
          :maxlength="ANNOTATION_MAX_TEXT_LENGTH"
          aria-label="标注文本"
          placeholder="输入这处波形的说明"
          @keydown="handleKeydown"
        />
      </label>

      <fieldset class="waveform-annotation-editor__colors">
        <legend>颜色与透明度</legend>
        <label class="waveform-annotation-editor__color-field" title="调整标注边框色和透明度">
          <span>边框色</span>
          <ColorPicker
            v-model:pure-color="borderColor"
            aria-label="标注边框色"
            use-type="pure"
            picker-type="chrome"
            format="rgb"
            :disable-alpha="false"
            :blur-close="true"
          />
        </label>
        <label class="waveform-annotation-editor__color-field" title="调整标注文字色和透明度">
          <span>文字色</span>
          <ColorPicker
            v-model:pure-color="textColor"
            aria-label="标注文字色"
            use-type="pure"
            picker-type="chrome"
            format="rgb"
            :disable-alpha="false"
            :blur-close="true"
          />
        </label>
        <label class="waveform-annotation-editor__color-field" title="调整标注背景色和透明度">
          <span>背景色</span>
          <ColorPicker
            v-model:pure-color="backgroundColor"
            aria-label="标注背景色"
            use-type="pure"
            picker-type="chrome"
            format="rgb"
            :disable-alpha="false"
            :blur-close="true"
          />
        </label>
      </fieldset>

      <footer class="waveform-annotation-editor__actions">
        <button type="button" @click="emit('cancel')">取消</button>
        <button type="button" class="is-primary" :disabled="!canConfirm" @click="confirm">
          保存标注
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.waveform-annotation-editor {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(16 24 40 / 32%);
  animation: waveform-annotation-editor-fade-in 160ms ease-out;
}

.waveform-annotation-editor__panel {
  display: grid;
  gap: 20px;
  width: min(440px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 22px;
  color: #344054;
  font-size: 13px;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgb(16 24 40 / 22%);
  animation: waveform-annotation-editor-rise-in 180ms ease-out;
}

.waveform-annotation-editor__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.waveform-annotation-editor__header h2 {
  margin: 0;
  color: #101828;
  font-size: 18px;
  line-height: 1.3;
}

.waveform-annotation-editor__header p {
  margin: 5px 0 0;
  color: #667085;
  font-size: 12px;
}

.waveform-annotation-editor__close {
  display: inline-grid;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  padding: 0;
  place-items: center;
  color: #667085;
  font-size: 22px;
  line-height: 1;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.waveform-annotation-editor__close:hover {
  color: #101828;
  background: #f2f4f7;
}

.waveform-annotation-editor__coordinates {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.waveform-annotation-editor__coordinates span {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  color: #667085;
  background: #f8fafc;
  border: 1px solid #eaecf0;
  border-radius: 7px;
}

.waveform-annotation-editor__coordinates b {
  color: #1677ff;
  font-size: 11px;
}

.waveform-annotation-editor__coordinates code {
  min-width: 0;
  overflow: hidden;
  color: #344054;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waveform-annotation-editor__series {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  background: #f8fafc;
  border: 1px solid #eaecf0;
  border-radius: 7px;
}

.waveform-annotation-editor__series i {
  flex: 0 0 12px;
  width: 12px;
  height: 12px;
  border: 1px solid rgb(0 0 0 / 12%);
  border-radius: 2px;
}

.waveform-annotation-editor__series-label {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.waveform-annotation-editor__series select {
  min-width: 0;
  max-width: 190px;
  margin-left: auto;
  padding: 5px 7px;
  color: #344054;
  font: inherit;
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 5px;
}

.waveform-annotation-editor__series small {
  color: #667085;
  font-size: 10px;
}

.waveform-annotation-editor__series b {
  overflow: hidden;
  color: #344054;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waveform-annotation-editor__series code {
  margin-left: auto;
  color: #667085;
  font-size: 11px;
}

.waveform-annotation-editor__field,
.waveform-annotation-editor__color-field {
  display: grid;
  gap: 4px;
}

.waveform-annotation-editor__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.waveform-annotation-editor__label-row b,
.waveform-annotation-editor__colors legend {
  color: #344054;
  font-size: 12px;
  font-weight: 600;
}

.waveform-annotation-editor__label-row small {
  color: #98a2b3;
  font-size: 11px;
}

.waveform-annotation-editor textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 92px;
  padding: 10px 11px;
  color: #1d2939;
  font: inherit;
  line-height: 1.5;
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 7px;
  resize: vertical;
}

.waveform-annotation-editor textarea:focus {
  border-color: #1677ff;
  outline: 3px solid rgb(22 119 255 / 14%);
}

.waveform-annotation-editor__colors {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 14px 0 0;
  border: 0;
  border-top: 1px solid #eaecf0;
}

.waveform-annotation-editor__colors legend {
  grid-column: 1 / -1;
  padding: 0;
}

.waveform-annotation-editor__color-field {
  align-items: stretch;
  min-width: 0;
  justify-items: stretch;
  color: #667085;
  font-size: 11px;
  text-align: left;
}

.waveform-annotation-editor__color-field :deep(.vc-color-wrap) {
  width: 100%;
  height: 34px;
  margin-right: 0;
  border: 1px solid #cfd5df;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 38%);
}

.waveform-annotation-editor__color-field :deep(.vc-color-wrap:hover) {
  border-color: #98a2b3;
  box-shadow: 0 0 0 3px rgb(22 119 255 / 12%);
}

.waveform-annotation-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #eaecf0;
}

.waveform-annotation-editor__actions button {
  height: 34px;
  padding: 0 12px;
  color: #475467;
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  cursor: pointer;
}

.waveform-annotation-editor__actions button.is-primary {
  color: #fff;
  background: #1677ff;
  border-color: #1677ff;
}

.waveform-annotation-editor__actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@keyframes waveform-annotation-editor-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes waveform-annotation-editor-rise-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 420px) {
  .waveform-annotation-editor {
    padding: 12px;
  }

  .waveform-annotation-editor__panel {
    gap: 16px;
    padding: 18px;
  }

  .waveform-annotation-editor__coordinates {
    grid-template-columns: 1fr;
  }
}
</style>

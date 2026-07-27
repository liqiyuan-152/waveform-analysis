<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ColorPicker } from 'vue3-colorpicker'
import 'vue3-colorpicker/style.css'

import type { WaveformAnnotation } from '../../types'
import { formatAnnotationTime, formatPlainNumber, type TimeUnit } from '../../utils'
import { ANNOTATION_MAX_TEXT_LENGTH, resolveAnnotationStyle } from './markup'
import type { AnnotationSeriesCandidate, AnnotationSeriesInfo } from './types'
import { useWaveformInstanceId } from '../../utils/waveformId'

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
const dialogTitleId = useWaveformInstanceId('waveform-annotation-editor-title')
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

<style scoped src="./WaveformAnnotationEditor.css"></style>

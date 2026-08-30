<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch, type Component } from 'vue'
import { InputNumber, Modal } from 'ant-design-vue'

import type { WaveformAnnotation } from '../../types'
import { formatAnnotationTime, formatPlainNumber, type TimeUnit } from '../../utils'
import { ANNOTATION_MAX_TEXT_LENGTH, resolveAnnotationStyle } from './markup'
import type { AnnotationSeriesCandidate, AnnotationSeriesInfo } from './types'
import { useWaveformInstanceId } from '../../utils/waveformId'

const ColorPicker = defineAsyncComponent(async (): Promise<Component> => {
  if (typeof window === 'undefined') {
    return { name: 'WaveformColorPickerSsrFallback', render: () => null }
  }
  return (await import('vue3-colorpicker')).ColorPicker
})

interface Props {
  annotation: WaveformAnnotation
  mode: 'add' | 'edit'
  series?: AnnotationSeriesInfo
  seriesOptions?: AnnotationSeriesCandidate[]
  timeUnit?: TimeUnit
  timeError?: string
}

const props = withDefaults(defineProps<Props>(), {
  timeUnit: 'ms',
  timeError: '',
})
const emit = defineEmits<{
  (event: 'confirm', annotation: WaveformAnnotation): void
  (event: 'cancel'): void
  (event: 'series-change', seriesId: string): void
  (event: 'time-change', displayValue: string): void
}>()

const textarea = ref<HTMLTextAreaElement>()
const dialogTitleId = useWaveformInstanceId('waveform-annotation-editor-title')
const text = ref('')
const timeInput = ref('')
const timeValidationRequested = ref(false)
const borderColor = ref('')
const textColor = ref('')
const backgroundColor = ref('')
const inputTimeError = computed(() => {
  if (!timeValidationRequested.value) return ''
  if (!timeInput.value.trim() || !Number.isFinite(Number(timeInput.value)))
    return '请输入有效的时间'
  return ''
})
const timeErrorMessage = computed(() =>
  timeValidationRequested.value ? inputTimeError.value || props.timeError || '' : '',
)
const canConfirm = computed(
  () =>
    text.value.trim().length > 0 &&
    timeInput.value.trim().length > 0 &&
    Number.isFinite(Number(timeInput.value)) &&
    !timeErrorMessage.value,
)
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
  timeInput.value = formatAnnotationTime(props.annotation.x, props.timeUnit)
  timeValidationRequested.value = false
  borderColor.value = style.borderColor
  textColor.value = style.textColor
  backgroundColor.value = style.backgroundColor
  void nextTick(() => textarea.value?.focus())
}

watch(() => props.annotation.id, hydrate, { immediate: true })

function handleTimeInput(value: number | string | null) {
  const nextValue = value === null || value === undefined ? '' : String(value)
  timeInput.value = nextValue
  timeValidationRequested.value = false
}

function commitTimeInput() {
  timeValidationRequested.value = true
  emit('time-change', timeInput.value)
}

async function confirm() {
  commitTimeInput()
  await nextTick()
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
  <Modal
    :visible="true"
    :width="440"
    :mask-closable="true"
    :keyboard="true"
    cancel-text="取消"
    ok-text="保存标注"
    :ok-button-props="{ disabled: !canConfirm }"
    root-class-name="waveform-annotation-editor-root"
    wrap-class-name="waveform-annotation-editor"
    @cancel="emit('cancel')"
    @ok="confirm"
  >
    <template #title>
      <span :id="dialogTitleId">{{ props.mode === 'add' ? '添加标注' : '编辑标注' }}</span>
    </template>

    <div class="waveform-annotation-editor__content">
      <div class="waveform-annotation-editor__coordinates" aria-label="标注坐标">
        <label
          class="waveform-annotation-editor__coordinate-input"
          :aria-invalid="Boolean(timeErrorMessage)"
        >
          <b>X</b>
          <InputNumber
            :value="timeInput === '' ? undefined : Number(timeInput)"
            :controls="true"
            :step="0.001"
            :keyboard="true"
            :status="timeErrorMessage ? 'error' : undefined"
            aria-label="标注横轴时间"
            :aria-invalid="Boolean(timeErrorMessage)"
            :aria-describedby="timeErrorMessage ? `${dialogTitleId}-time-error` : undefined"
            @blur="commitTimeInput"
            @update:value="handleTimeInput"
          />
          <code class="waveform-annotation-editor__coordinate-value" aria-hidden="true">{{
            timeInput
          }}</code>
        </label>
        <p
          v-if="timeErrorMessage"
          :id="`${dialogTitleId}-time-error`"
          class="waveform-annotation-editor__coordinate-error"
          role="alert"
        >
          {{ timeErrorMessage }}
        </p>
        <span
          ><b>Y</b><code>{{ formatPlainNumber(props.annotation.y) }}</code></span
        >
      </div>
      <p class="waveform-annotation-editor__coordinate-hint" role="note">
        修改 X 轴后失焦时会自动吸附最近的采样点
      </p>

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
    </div>
  </Modal>
</template>

<style scoped src="./WaveformAnnotationEditor.css"></style>

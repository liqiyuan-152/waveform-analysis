<script setup lang="ts">
import { ref, watch } from 'vue'
import { Input, InputNumber, Select, Slider, Switch } from 'ant-design-vue'
import { isCssColor, parseNumberInput, type FieldDefinition } from '../../config/fields'
import ColorControl from './ColorControl.vue'
const props = defineProps<{ field: FieldDefinition; value: unknown; disabled?: boolean }>()
const emit = defineEmits<{ change: [value: unknown] }>()
// Antd's decimal parser cannot expand exponents below -100 itself.
function decimalText(value: string | undefined): string {
  const text = value ?? ''
  const match = /^([+-]?)(\d+)(?:\.(\d*))?[eE]-(\d+)$/.exec(text)
  if (!match || Number(match[4]) <= 100) return text
  const digits = match[2] + (match[3] ?? '')
  const position = match[2].length - Number(match[4])
  if (position > 0 || position < -1000) return text
  return `${match[1]}0.${'0'.repeat(-position)}${digits}`
}
const raw = ref('')
const invalid = ref(false)
watch(
  () => props.value,
  (value) => {
    raw.value = value == null ? '' : String(value)
    invalid.value = false
  },
  { immediate: true },
)
function input(value: string | number | null) {
  raw.value = value == null ? '' : String(value)
  const field = props.field
  const parsed = field.parse
    ? field.parse(raw.value)
    : field.kind === 'number' || field.kind === 'range'
      ? parseNumberInput(raw.value, field.optional)
      : {
          valid:
            field.kind === 'color' ? isCssColor(raw.value) : (field.validate?.(raw.value) ?? true),
          value: raw.value,
        }
  invalid.value =
    !parsed.valid ||
    (typeof parsed.value === 'number' &&
      ((field.min !== undefined && parsed.value < field.min) ||
        (field.max !== undefined && parsed.value > field.max)))
  if (!invalid.value) emit('change', parsed.value)
}
</script>
<template>
  <div class="config-field" :class="{ 'config-field--switch': field.kind === 'boolean' }">
    <span class="config-field__label">{{ field.label }}</span>
    <div class="config-field__control" :class="{ 'range-control': field.kind === 'range' }">
      <Switch
        v-if="field.kind === 'boolean'"
        :checked="Boolean(value)"
        :disabled="disabled"
        :aria-label="field.label"
        @update:checked="emit('change', $event)"
      />
      <Select
        v-else-if="field.kind === 'select'"
        :value="value as string"
        :options="field.options ? [...field.options] : []"
        :disabled="disabled"
        :aria-label="field.label"
        @update:value="emit('change', $event)"
      />
      <ColorControl
        v-else-if="field.kind === 'color'"
        :value="raw"
        :label="field.label"
        :disabled="disabled"
        :invalid="invalid"
        @change="input"
      />
      <template v-else-if="field.kind === 'number' || field.kind === 'range'">
        <Slider
          v-if="field.kind === 'range'"
          :value="Number(value)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :disabled="disabled"
          :aria-label-for-handle="`${field.label}滑块`"
          @change="(value) => !Array.isArray(value) && input(value)"
        />
        <InputNumber
          string-mode
          :parser="decimalText"
          :value="raw === '' ? undefined : decimalText(raw)"
          :min="field.min === Number.MIN_VALUE ? 0 : field.min"
          :max="field.max"
          :step="field.step"
          :disabled="disabled"
          :status="invalid ? 'error' : undefined"
          :aria-label="field.label"
          :aria-invalid="invalid"
          @input="input"
          @step="input"
        />
      </template>
      <Input
        v-else
        :value="raw"
        :disabled="disabled"
        :status="invalid ? 'error' : undefined"
        :aria-label="field.label"
        :aria-invalid="invalid"
        @update:value="input"
      />
    </div>
    <small v-if="invalid" class="field-error" role="alert">请输入有效的{{ field.label }}</small>
  </div>
</template>

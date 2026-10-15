<script setup lang="ts">
import { ref } from 'vue'
import { stepNumberInput } from '@/components/controls/numberInput'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ value: string; invalid?: boolean }>()
const emit = defineEmits<{ 'update:value': [value: string]; blur: [] }>()
const input = ref<HTMLInputElement>()
function step(direction: 1 | -1) {
  emit('update:value', stepNumberInput(props.value, direction))
  input.value?.focus()
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    step(event.key === 'ArrowUp' ? 1 : -1)
  }
}
</script>

<template>
  <div class="waveform-number-input" :class="{ 'is-invalid': invalid }">
    <input
      ref="input"
      v-bind="$attrs"
      type="text"
      inputmode="decimal"
      role="spinbutton"
      :aria-valuenow="value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined"
      :value="value"
      @input="emit('update:value', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur')"
      @keydown="keydown"
    />
    <div class="waveform-number-input__steps">
      <button type="button" aria-label="增加时间" @mousedown.prevent @click="step(1)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 10 5-5 5 5" /></svg>
      </button>
      <button type="button" aria-label="减少时间" @mousedown.prevent @click="step(-1)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped src="../../../../../src/components/controls/WaveformNumberInput.css"></style>

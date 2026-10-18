<script setup lang="ts">
import { computed } from 'vue'
import { Button, Input, Popover, Slider } from 'ant-design-vue'
import { color, rgb } from 'd3'
const props = defineProps<{ value: string; label: string; disabled?: boolean; invalid?: boolean }>()
const emit = defineEmits<{ change: [value: string] }>()
const parsed = computed(() => {
  const result = color(props.value)?.rgb()
  if (!result || result.opacity !== 0) return result
  // d3 deliberately drops RGB channels at alpha=0; recover the explicit opaque source
  // so moving the slider back up (even after remounting) preserves the user's color.
  const opaque = props.value
    .trim()
    .replace(/^#([\da-f]{3})[\da-f]$/i, '#$1')
    .replace(/^#([\da-f]{6})[\da-f]{2}$/i, '#$1')
    .replace(/^rgba\((.*),[^,]+\)$/i, 'rgb($1)')
    .replace(/^hsla\((.*),[^,]+\)$/i, 'hsl($1)')
  const channels = color(opaque)?.rgb()
  return channels && [channels.r, channels.g, channels.b].every(Number.isFinite)
    ? rgb(channels.r, channels.g, channels.b, 0)
    : rgb(0, 0, 0, 0)
})
const presets = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#0891b2',
  '#f59e0b',
  '#ffffff',
  '#000000',
]
function alpha(value: number | number[]) {
  const next = parsed.value?.rgb()
  if (!next || Array.isArray(value)) return
  next.opacity = value
  emit('change', next.formatRgb())
}
</script>
<template>
  <div class="color-control">
    <Popover trigger="click" :title="label">
      <template #content>
        <div class="color-presets">
          <Button
            v-for="preset in presets"
            :key="preset"
            :disabled="disabled"
            :aria-label="`${label} ${preset}`"
            @click="emit('change', preset)"
            ><span class="color-swatch" :style="{ background: preset }"
          /></Button>
        </div>
        <div class="color-alpha">
          <span>透明度</span
          ><Slider
            :value="parsed?.opacity ?? 1"
            :min="0"
            :max="1"
            :step="0.05"
            :disabled="disabled || !parsed"
            :aria-label-for-handle="`${label}透明度`"
            @change="alpha"
          />
        </div>
      </template>
      <Button class="color-trigger" :disabled="disabled" :aria-label="`${label}色板`"
        ><span class="color-swatch" :style="{ background: parsed ? value : 'transparent' }"
      /></Button>
    </Popover>
    <Input
      :value="value"
      :disabled="disabled"
      :status="invalid ? 'error' : undefined"
      :aria-invalid="invalid"
      :aria-label="label"
      @update:value="emit('change', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Waveform, WaveformData, WaveformOptions } from 'waveform-analysis/display'
import { useWaveform } from '../composables/useWaveform'

const props = defineProps<{ data: WaveformData; options: WaveformOptions }>()
const emit = defineEmits<{ ready: [chart: Waveform]; error: [error: Error] }>()
const container = ref<HTMLElement | null>(null)
const chart = useWaveform(
  container,
  () => props,
  (error) => emit('error', error),
)
watch(
  chart,
  (value) => {
    if (value) emit('ready', value)
  },
  { flush: 'sync' },
)
watch(
  () => [props.data, props.options] as const,
  ([data, options], previous) =>
    chart.value?.update({
      data: data !== previous[0] ? data : undefined,
      options: options !== previous[1] ? options : undefined,
    }),
)
defineExpose({ chart })
</script>

<template><div ref="container" class="waveform-preview" /></template>

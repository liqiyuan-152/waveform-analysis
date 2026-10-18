<script setup lang="ts">
import type { WaveformOptions } from 'waveform-analysis/display'
import { getAtPath, type FieldDefinition } from '../../config/fields'
import ConfigField from './ConfigField.vue'
defineProps<{ fields: FieldDefinition[]; options: WaveformOptions }>()
const emit = defineEmits<{ field: [path: string, value: unknown] }>()
</script>
<template>
  <div class="config-grid">
    <ConfigField
      v-for="field in fields"
      :key="field.path"
      :field="field"
      :value="getAtPath(options, field.path)"
      @change="emit('field', field.path, $event)"
    />
  </div>
</template>

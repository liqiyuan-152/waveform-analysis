import { getCurrentInstance } from 'vue'

let fallbackId = 0

/** Generate an instance-scoped id without requiring Vue 3.5's useId API. */
export function useWaveformInstanceId(prefix = 'waveform') {
  const instance = getCurrentInstance()
  const instanceId = instance ? `v${instance.uid}` : `f${++fallbackId}`
  return `${prefix}-${instanceId}`
}

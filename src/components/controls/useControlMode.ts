import { computed, ref, watch } from 'vue'
import type { WaveformControlResult } from '../../types/controls'
import type { WaveformInteractionMode } from '../../types'
import type { ResolvedWaveformChartProps, WaveformChartEmit } from '../core/waveformChartTypes'

export function useControlMode(props: ResolvedWaveformChartProps, emit: WaveformChartEmit) {
  const internalMode = ref<WaveformInteractionMode>('zoom')
  const mode = computed(() => props.interactionMode ?? internalMode.value)
  const canSetMode = (value: WaveformInteractionMode) =>
    !props.presentationMode &&
    (value === 'none' ||
      (value === 'zoom' && props.zoomable) ||
      (value === 'pan' && props.pannable) ||
      (value === 'annotation' && props.annotationsVisible))
  function setInteractionMode(value: WaveformInteractionMode): WaveformControlResult {
    let status: Extract<WaveformControlResult, { kind: 'mode' }>['status']
    if (!canSetMode(value)) status = 'disabled'
    else if (mode.value === value) status = 'unchanged'
    else if (props.interactionMode !== undefined) {
      emit('update:interactionMode', value)
      status = 'requested'
    } else {
      internalMode.value = value
      status = 'applied'
    }
    return { kind: 'mode', status, targets: [] }
  }
  watch(mode, (value) => emit('interaction-mode-change', value))
  return { mode, canSetMode, setInteractionMode }
}

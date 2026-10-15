import { computed, onScopeDispose, shallowRef, watch, type ComputedRef, type ShallowRef } from 'vue'
import { RenderSamplingController } from '@/sampling/RenderSamplingController'
import type { WaveformPoint } from '@/types/index'
import type { ResolvedWaveformRenderingOptions } from '@/core/renderingOptions'
import type { PreparedWaveformSeries } from './useWaveformData'
import type { TrackLayout } from '@/components/core/types'
import type {
  ResolvedWaveformChartProps,
  WaveformChartEmit,
} from '@/components/core/waveformChartTypes'

interface SamplingContext {
  props: ResolvedWaveformChartProps
  emit: WaveformChartEmit
  instanceId: string
  preparedSeries: ShallowRef<PreparedWaveformSeries[]>
  sourceTrackLayouts: ComputedRef<TrackLayout[]>
  renderingOptions: ComputedRef<ResolvedWaveformRenderingOptions>
  linePointOverrides: ShallowRef<Record<string, WaveformPoint[]>>
}

/** Reactive bridge only; transport, async invalidation and diagnostics belong to the shared class. */
export function useWaveformRenderSampling(context: SamplingContext) {
  const version = shallowRef(0)
  const controller = new RenderSamplingController(
    context.instanceId,
    { emit: context.emit },
    () => {
      context.linePointOverrides.value = controller.overrides
      version.value += 1
    },
  )
  watch(
    [context.preparedSeries, context.sourceTrackLayouts, context.renderingOptions],
    ([series, tracks, rendering]) => controller.update({ series, tracks, rendering }),
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => controller.dispose())
  return {
    requestSignature: computed(() => {
      void version.value
      return controller.signature
    }),
    state: computed(() => {
      void version.value
      return controller.state
    }),
    linePointOverrides: context.linePointOverrides,
    ready: () => controller.ready(),
  }
}

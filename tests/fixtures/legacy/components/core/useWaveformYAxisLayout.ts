import { computed, type ComputedRef } from 'vue'

import type { NormalizedWaveformGridOptions } from '@/components/core/grid'
import type { DisplayTrack } from '@/components/core/types'
import type { ResolvedWaveformChartProps } from '@/components/core/waveformChartTypes'
import { AxisLayoutEngine } from '@/layout/AxisLayoutEngine'

interface YAxisLayoutContext {
  props: ResolvedWaveformChartProps
  chartTracks: ComputedRef<DisplayTrack[]>
  layoutTracks: ComputedRef<DisplayTrack[]>
  chartWidth: ComputedRef<number>
  gridOptions: ComputedRef<NormalizedWaveformGridOptions>
  viewportYDomains: ComputedRef<Record<string, [number, number]>>
  yAxisTickCount: ComputedRef<number>
}

export function useWaveformYAxisLayout(context: YAxisLayoutContext) {
  const engine = new AxisLayoutEngine()
  const layout = computed(() =>
    engine.calculate(
      context.props,
      context.chartTracks.value,
      context.layoutTracks.value,
      context.gridOptions.value,
      context.chartWidth.value,
      0,
      context.viewportYDomains.value,
      context.yAxisTickCount.value,
    ),
  )
  return {
    yAxisMetrics: computed(() => layout.value.metrics),
    yAxisSlots: computed(() => layout.value.slotLayout),
    resolvedChartLeftMargin: computed(() => layout.value.left),
    innerWidth: computed(() => layout.value.innerWidth),
    yAxisLayout: computed(() => ({
      horizontalGap: layout.value.horizontalGap,
      hideSecondaryLabels: layout.value.hideSecondaryLabels,
    })),
    hasVisibleWaveformData: computed(() => layout.value.hasVisibleWaveformData),
  }
}

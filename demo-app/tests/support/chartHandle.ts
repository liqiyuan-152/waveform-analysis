import type { WaveformChartHandle } from 'waveform-analysis/vue'

// A production SFC exposes its parent-ref API through exposed, while VTU's vm is its proxy.
export function chartHandle(chart: { vm: { $: { exposed: unknown } } }): WaveformChartHandle {
  const exposed = chart.vm.$.exposed
  if (!exposed) throw new Error('The chart did not expose its public handle.')
  return exposed as WaveformChartHandle
}

import type { ResolvedWaveformChartProps } from '@/components/core/waveformChartTypes'
import { chartExportOptions } from '@/components/controls/chartExportOptions'
export function chartExportVersion(props: ResolvedWaveformChartProps, state: object): unknown[] {
  return [props.data, JSON.stringify({ ...chartExportOptions(props), ...state })]
}

import type { ResolvedWaveformChartProps } from '../core/waveformChartTypes'
import { chartExportOptions } from '../controls/chartExportOptions'
export function chartExportVersion(props: ResolvedWaveformChartProps, state: object): unknown[] {
  return [props.data, JSON.stringify({ ...chartExportOptions(props), ...state })]
}

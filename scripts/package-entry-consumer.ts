import { init, type WaveformChartInstance } from 'waveform-analysis'
import { init as nativeInit, type WaveformChartOptions } from 'waveform-analysis/native'
import {
  WaveformChart,
  type WaveformChartProps,
  type WaveformChartHandle,
} from 'waveform-analysis/vue'

const sameInit: typeof init = nativeInit
const props: WaveformChartProps = { data: { kind: 'points', points: [] } }
const options: WaveformChartOptions = props
const instance = (chart: WaveformChartInstance, vueChart: WaveformChartHandle) => {
  chart.setOption(options)
  vueChart.resetViewport()
}
void [sameInit, WaveformChart, instance]

import type { ComponentOptionsMixin, DefineComponent } from 'vue'
import type { WaveformChartProps } from '../../types/options'
import type { WaveformChartHandle } from '../../types/controls'
import type { WaveformChartEvents } from '../../types/native'
import Component from './WaveformChart.vue'

type VueEmits = {
  [Event in keyof WaveformChartEvents]: (...args: WaveformChartEvents[Event]) => void
}

// Keep public declarations within Vue 3.2's DefineComponent signature. Inferred SFC
// declarations depend on the Vue version used to build the package.
type VueChartComponent = DefineComponent<
  WaveformChartProps,
  WaveformChartHandle,
  Record<never, never>,
  Record<never, never>,
  Record<never, never>,
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  VueEmits
>
export const WaveformChart = Component as unknown as VueChartComponent

export type { WaveformChartProps } from '../../types/options'
export type { WaveformChartHandle } from '../../types/controls'

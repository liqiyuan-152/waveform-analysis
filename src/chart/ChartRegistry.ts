import type { WaveformChartInstance } from '../types/native'

/** Module-local registry is shared by all public entries of the same module format. */
export const chartRegistry = new WeakMap<HTMLElement, WaveformChartInstance>()

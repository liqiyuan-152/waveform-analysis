import type { WaveformAxesOptions } from '../../types'
import type { YAxisSeriesGroup } from './layout'

export type YAxisPaddingOptions = WaveformAxesOptions['y']

export function paddingRatio(enabled?: boolean, ratio?: number): number {
  if (enabled === false) return 0
  const value = ratio ?? (enabled === true ? 0.1 : 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function applyYAxisPadding(
  group: YAxisSeriesGroup,
  viewport: [number, number] | undefined,
  options: YAxisPaddingOptions | number,
): YAxisSeriesGroup {
  if (group.fixed) return group
  const config = typeof options === 'number' ? { upperPaddingRatio: options } : options
  const upper = paddingRatio(config?.upperPaddingEnabled, config?.upperPaddingRatio)
  const lower = paddingRatio(config?.lowerPaddingEnabled, config?.lowerPaddingRatio)
  const maxima = group.seriesList.flatMap((series) =>
    Number.isFinite(series.rawYMaximum) ? [series.rawYMaximum!] : [],
  )
  const maximumTick = upper > 0 && maxima.length ? Math.max(...maxima) : undefined
  const [a, b] = group.domain
  const span = b - a
  const min = lower > 0 ? a - span * lower : a
  const max = upper > 0 ? b + span * upper : b
  return {
    ...group,
    maximumTick,
    domain: viewport ?? [Number.isFinite(min) ? min : a, Number.isFinite(max) ? max : b],
  }
}

export function withMaximumTick(values: number[], maximum?: number): number[] {
  if (maximum === undefined || !Number.isFinite(maximum)) return values
  return [...values.filter((value) => !sameTick(value, maximum)), maximum].sort((a, b) => a - b)
}

export function sameTick(a: number, b: number): boolean {
  return (
    Math.abs(a - b) <= Number.EPSILON * 8 * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE)
  )
}

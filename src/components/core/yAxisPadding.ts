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
  const config = typeof options === 'number' ? { upperPaddingRatio: options } : options
  if (group.fixed) return withYAxisExtremaTicks(group, config?.extremaTicksVisible)
  const upper = paddingRatio(config?.upperPaddingEnabled, config?.upperPaddingRatio)
  const lower = paddingRatio(config?.lowerPaddingEnabled, config?.lowerPaddingRatio)
  const [a, b] = group.domain
  const span = b - a
  const min = lower > 0 ? a - span * lower : a
  const max = upper > 0 ? b + span * upper : b
  return withYAxisExtremaTicks(
    {
      ...group,
      domain: viewport ?? [Number.isFinite(min) ? min : a, Number.isFinite(max) ? max : b],
    },
    config?.extremaTicksVisible,
  )
}

function withYAxisExtremaTicks(group: YAxisSeriesGroup, visible = true): YAxisSeriesGroup {
  const maxima = group.seriesList.flatMap((series) =>
    Number.isFinite(series.rawYMaximum) ? [series.rawYMaximum!] : [],
  )
  const minima = group.seriesList.flatMap((series) =>
    Number.isFinite(series.rawYMinimum) ? [series.rawYMinimum!] : [],
  )
  return {
    ...group,
    maximumTick: visible && maxima.length ? Math.max(...maxima) : undefined,
    minimumTick: visible && minima.length ? Math.min(...minima) : undefined,
  }
}

export function withMaximumTick(values: number[], maximum?: number, minimum?: number): number[] {
  if (minimum !== undefined && Number.isFinite(minimum)) {
    values = [...values.filter((value) => !sameTick(value, minimum)), minimum].sort((a, b) => a - b)
  }
  if (maximum === undefined || !Number.isFinite(maximum)) return values
  return [...values.filter((value) => !sameTick(value, maximum)), maximum].sort((a, b) => a - b)
}

export function sameTick(a: number, b: number): boolean {
  return (
    Math.abs(a - b) <= Number.EPSILON * 8 * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE)
  )
}

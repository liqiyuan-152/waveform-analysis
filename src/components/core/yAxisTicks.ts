import type { WaveformAmplitudeLimit } from '../../types'
import { resolveYAxisTicksECharts } from './niceScale'

export interface ResolvedYAxisTicks {
  domain: [number, number]
  values: number[]
}

export function resolveYAxisTicks(
  domain: [number, number],
  tickCount = 5,
  nice = true,
  bounds?: WaveformAmplitudeLimit,
): ResolvedYAxisTicks {
  if (!nice) {
    // 如果不需要 nice，使用简单的线性分割
    const effectiveTickCount =
      typeof tickCount === 'number' && Number.isFinite(tickCount)
        ? Math.max(2, Math.floor(tickCount))
        : 5
    const [axisStart, axisEnd] = domain
    return {
      domain,
      values: Array.from(
        { length: effectiveTickCount },
        (_, index) => axisStart + ((axisEnd - axisStart) * index) / (effectiveTickCount - 1),
      ),
    }
  }

  // 使用 ECharts 兼容的 1/2/5 系列算法
  const ticks = resolveYAxisTicksECharts(domain, tickCount)
  if (!bounds) return ticks
  const bounded: [number, number] = [
    bounds.lower ?? ticks.domain[0],
    bounds.upper ?? ticks.domain[1],
  ]
  return {
    domain: bounded,
    values: ticks.values.filter((value) => value >= bounded[0] && value <= bounded[1]),
  }
}

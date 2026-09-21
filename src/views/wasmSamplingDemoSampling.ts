import type { WaveformSamplingOptions, WaveformSamplingStrategy } from '../types'

type SamplingSizeOptions = Pick<WaveformSamplingOptions, 'maxPointCount' | 'maxPointsPerPixel'>

const fixedPointCountStrategies: readonly WaveformSamplingStrategy[] = ['lttb', 'average', 'sum']

export function usesFixedPointCount(strategy: WaveformSamplingStrategy) {
  return fixedPointCountStrategies.includes(strategy)
}

export function showsSamplingSize(strategy: WaveformSamplingStrategy) {
  return strategy !== 'none'
}

export function samplingSizeOptions(
  strategy: WaveformSamplingStrategy,
  maxPointsPerPixel: number,
  maxPointCount: number,
): SamplingSizeOptions {
  if (usesFixedPointCount(strategy)) return { maxPointCount }
  if (!showsSamplingSize(strategy)) return {}
  return { maxPointsPerPixel }
}

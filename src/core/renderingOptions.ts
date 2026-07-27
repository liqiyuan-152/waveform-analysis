import type { WaveformRenderingOptions } from '@/types'

export interface ResolvedWaveformRenderingOptions {
  downsample: boolean
  downsampleThreshold: number
  maxPointsPerPixel: number
  pointMinSpacing: number
  errorBarMinSpacing: number
}

export const DEFAULT_WAVEFORM_RENDERING_OPTIONS: ResolvedWaveformRenderingOptions = {
  downsample: true,
  downsampleThreshold: 2_000,
  maxPointsPerPixel: 4,
  pointMinSpacing: 10,
  errorBarMinSpacing: 12,
}

export function resolveWaveformRenderingOptions(
  options?: WaveformRenderingOptions,
): ResolvedWaveformRenderingOptions {
  const threshold = Number(options?.downsampleThreshold)
  const pointsPerPixel = Number(options?.maxPointsPerPixel)
  const pointMinSpacing = Number(options?.pointMinSpacing)
  const errorBarMinSpacing = Number(options?.errorBarMinSpacing)
  return {
    downsample: options?.downsample ?? DEFAULT_WAVEFORM_RENDERING_OPTIONS.downsample,
    downsampleThreshold:
      Number.isFinite(threshold) && threshold >= 2
        ? Math.floor(threshold)
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.downsampleThreshold,
    maxPointsPerPixel:
      Number.isFinite(pointsPerPixel) && pointsPerPixel > 0
        ? pointsPerPixel
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.maxPointsPerPixel,
    pointMinSpacing:
      Number.isFinite(pointMinSpacing) && pointMinSpacing >= 0
        ? pointMinSpacing
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.pointMinSpacing,
    errorBarMinSpacing:
      Number.isFinite(errorBarMinSpacing) && errorBarMinSpacing >= 0
        ? errorBarMinSpacing
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.errorBarMinSpacing,
  }
}

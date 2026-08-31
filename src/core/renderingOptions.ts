import type {
  WaveformRenderingOptions,
  WaveformSamplingMode,
  WaveformSamplingOptions,
  WaveformSamplingStrategy,
} from '@/types'

export interface ResolvedWaveformSamplingOptions {
  mode: WaveformSamplingMode
  autoThreshold: number
  autoHysteresis: number
  strategy: WaveformSamplingStrategy
  maxPointsPerPixel: number
  maxPointCount: number | undefined
  rawPointLimit: number
  wasmFailureFallback: 'error' | 'javascript'
}

export interface ResolvedWaveformRenderingOptions {
  downsample: boolean
  downsampleThreshold: number
  maxPointsPerPixel: number
  pointMinSpacing: number
  errorBarMinSpacing: number
  sampling: ResolvedWaveformSamplingOptions
}

export const DEFAULT_WAVEFORM_RENDERING_OPTIONS: ResolvedWaveformRenderingOptions = {
  downsample: true,
  downsampleThreshold: 2_000,
  maxPointsPerPixel: 4,
  pointMinSpacing: 10,
  errorBarMinSpacing: 12,
  sampling: {
    mode: 'auto',
    autoThreshold: 1_000,
    autoHysteresis: 0,
    strategy: 'peak',
    maxPointsPerPixel: 4,
    maxPointCount: undefined,
    rawPointLimit: 100_000,
    wasmFailureFallback: 'error',
  },
}

const samplingModes: readonly WaveformSamplingMode[] = ['auto', 'wasm', 'raw']
const samplingStrategies: readonly WaveformSamplingStrategy[] = [
  'auto',
  'none',
  'peak',
  'lttb',
  'average',
  'min',
  'max',
  'minmax',
  'sum',
]

function isSamplingMode(value: unknown): value is WaveformSamplingMode {
  return typeof value === 'string' && samplingModes.includes(value as WaveformSamplingMode)
}

function isSamplingStrategy(value: unknown): value is WaveformSamplingStrategy {
  return typeof value === 'string' && samplingStrategies.includes(value as WaveformSamplingStrategy)
}

function resolveFiniteInteger(value: unknown, minimum: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum
    ? Math.floor(value)
    : fallback
}

function resolvePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function resolveOptionalFiniteInteger(value: unknown, minimum: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum
    ? Math.floor(value)
    : undefined
}

function resolveNonNegativeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function resolveSamplingOptions(
  options: WaveformSamplingOptions | undefined,
  legacyDownsample: boolean | undefined,
  legacyMaxPointsPerPixel: number,
): ResolvedWaveformSamplingOptions {
  const mode = isSamplingMode(options?.mode)
    ? options.mode
    : legacyDownsample === false
      ? 'raw'
      : DEFAULT_WAVEFORM_RENDERING_OPTIONS.sampling.mode
  const maxPointsPerPixel = resolvePositiveNumber(
    options?.maxPointsPerPixel,
    legacyMaxPointsPerPixel,
  )
  return {
    mode,
    autoThreshold: resolveFiniteInteger(
      options?.autoThreshold,
      1,
      DEFAULT_WAVEFORM_RENDERING_OPTIONS.sampling.autoThreshold,
    ),
    autoHysteresis: resolveFiniteInteger(
      options?.autoHysteresis,
      0,
      DEFAULT_WAVEFORM_RENDERING_OPTIONS.sampling.autoHysteresis,
    ),
    strategy: isSamplingStrategy(options?.strategy)
      ? options.strategy
      : DEFAULT_WAVEFORM_RENDERING_OPTIONS.sampling.strategy,
    maxPointsPerPixel,
    maxPointCount: resolveOptionalFiniteInteger(options?.maxPointCount, 1),
    rawPointLimit: resolveFiniteInteger(
      options?.rawPointLimit,
      1,
      DEFAULT_WAVEFORM_RENDERING_OPTIONS.sampling.rawPointLimit,
    ),
    wasmFailureFallback:
      options?.wasmFailureFallback === 'javascript' || options?.wasmFailureFallback === 'error'
        ? options.wasmFailureFallback
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.sampling.wasmFailureFallback,
  }
}

export function resolveWaveformRenderingOptions(
  options?: WaveformRenderingOptions,
): ResolvedWaveformRenderingOptions {
  const threshold = Number(options?.downsampleThreshold)
  const legacyMaxPointsPerPixel = Number(options?.maxPointsPerPixel)
  const pointMinSpacing = Number(options?.pointMinSpacing)
  const errorBarMinSpacing = Number(options?.errorBarMinSpacing)
  const resolvedLegacyMaxPointsPerPixel =
    Number.isFinite(legacyMaxPointsPerPixel) && legacyMaxPointsPerPixel > 0
      ? legacyMaxPointsPerPixel
      : DEFAULT_WAVEFORM_RENDERING_OPTIONS.maxPointsPerPixel
  const sampling = resolveSamplingOptions(
    options?.sampling,
    typeof options?.downsample === 'boolean' ? options.downsample : undefined,
    resolvedLegacyMaxPointsPerPixel,
  )
  return {
    downsample: sampling.mode !== 'raw',
    downsampleThreshold:
      Number.isFinite(threshold) && threshold >= 2
        ? Math.floor(threshold)
        : DEFAULT_WAVEFORM_RENDERING_OPTIONS.downsampleThreshold,
    maxPointsPerPixel: sampling.maxPointsPerPixel,
    pointMinSpacing: resolveNonNegativeNumber(
      pointMinSpacing,
      DEFAULT_WAVEFORM_RENDERING_OPTIONS.pointMinSpacing,
    ),
    errorBarMinSpacing: resolveNonNegativeNumber(
      errorBarMinSpacing,
      DEFAULT_WAVEFORM_RENDERING_OPTIONS.errorBarMinSpacing,
    ),
    sampling,
  }
}

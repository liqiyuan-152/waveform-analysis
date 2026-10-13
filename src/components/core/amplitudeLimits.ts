import type { WaveformAmplitudeLimit, WaveformAmplitudeLimits } from '../../types'

export function normalizeAmplitudeLimit(
  limit?: WaveformAmplitudeLimit,
): WaveformAmplitudeLimit | undefined {
  if (!limit) return undefined
  const lower = Number.isFinite(limit.lower) ? limit.lower : undefined
  const upper = Number.isFinite(limit.upper) ? limit.upper : undefined
  if (lower === undefined && upper === undefined) return undefined
  if (lower !== undefined && upper !== undefined && lower >= upper) return undefined
  return { lower, upper }
}

export function mergeAmplitudeLimits(
  series: readonly { id: string }[],
  limits?: WaveformAmplitudeLimits,
): WaveformAmplitudeLimit | undefined {
  const valid = series.flatMap((item) => {
    const limit = normalizeAmplitudeLimit(limits?.[item.id])
    return limit ? [limit] : []
  })
  const lowers = valid.flatMap((limit) => (limit.lower === undefined ? [] : [limit.lower]))
  const uppers = valid.flatMap((limit) => (limit.upper === undefined ? [] : [limit.upper]))
  return normalizeAmplitudeLimit({
    lower: lowers.length ? Math.min(...lowers) : undefined,
    upper: uppers.length ? Math.max(...uppers) : undefined,
  })
}

export function applyAmplitudeLimits(
  padded: [number, number],
  limit: WaveformAmplitudeLimit,
  automatic: [number, number] = padded,
): [number, number] {
  let lower = limit.lower ?? padded[0]
  let upper = limit.upper ?? padded[1]
  if (lower >= upper) {
    const fixed = limit.lower ?? limit.upper!
    const span = Math.max(automatic[1] - automatic[0], Math.abs(fixed) * 0.1, 1)
    if (limit.lower !== undefined) upper = lower + span
    else lower = upper - span
  }
  return [lower, upper]
}

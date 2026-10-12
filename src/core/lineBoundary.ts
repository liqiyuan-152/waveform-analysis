import type { WaveformPointRange } from './waveformPointSource'

/** Outside neighbors join the curve without changing visible-point statistics. */
export function lineBoundaryIndexes(range: WaveformPointRange, length: number): number[] {
  if (!length || (range.start === range.end && (range.start === 0 || range.end === length)))
    return []
  return [range.start > 0 ? range.start - 1 : -1, range.end < length ? range.end : -1].filter(
    (index) => index >= 0,
  )
}

export function withLineBoundaries<T>(
  points: T[],
  range: WaveformPointRange,
  length: number,
  pointAt: (index: number) => T,
): T[] {
  const boundaries = lineBoundaryIndexes(range, length)
  return [
    ...boundaries.filter((index) => index < range.start).map(pointAt),
    ...points,
    ...boundaries.filter((index) => index >= range.end).map(pointAt),
  ]
}

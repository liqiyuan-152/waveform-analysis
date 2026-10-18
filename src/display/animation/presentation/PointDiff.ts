import type { WaveformPoint } from '../../types/data.js'

export interface PointMatch {
  target: WaveformPoint
  previous?: WaveformPoint
}

/** Identity is exact: neither approximate X values nor array indices are keys. */
export function diffPoints(
  previous: readonly WaveformPoint[],
  target: readonly WaveformPoint[],
): PointMatch[] | undefined {
  const all = [...previous, ...target]
  const withIds = all.every((point) => !!point.id?.trim())
  if (!withIds && all.some((point) => !!point.id?.trim())) return undefined
  const key = (point: WaveformPoint): string | number => (withIds ? point.id!.trim() : point.x)
  const old = new Map<string | number, { point: WaveformPoint; index: number }>()
  for (const [index, point] of previous.entries()) {
    const identity = key(point)
    if (old.has(identity)) return undefined
    old.set(identity, { point, index })
  }
  const seen = new Set<string | number>()
  const matches: PointMatch[] = []
  let lastIndex = -1
  for (const point of target) {
    const identity = key(point)
    if (seen.has(identity)) return undefined
    seen.add(identity)
    const match = old.get(identity)
    if (match) {
      if (match.index < lastIndex) return undefined
      lastIndex = match.index
    }
    matches.push({ target: { ...point }, previous: match && { ...match.point } })
  }
  return matches
}

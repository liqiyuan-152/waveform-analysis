import type { TrackLayout } from '../core/types'

type Frame = Pick<TrackLayout, 'left' | 'top' | 'width' | 'height' | 'isEmpty'>

/** Keep the lower frame's top edge as the single owner of a shared boundary. */
export function compactFramePath(track: Frame, tracks: Frame[], inset = 0): string | undefined {
  let uncovered: [number, number][] = [[0, track.width]]
  for (const below of tracks) {
    if (below === track || below.isEmpty) continue
    if (Math.abs(track.top + track.height - below.top) > 1e-6) continue
    const start = Math.max(0, below.left - track.left)
    const end = Math.min(track.width, below.left + below.width - track.left)
    if (end <= start) continue
    uncovered = uncovered.flatMap(([left, right]): [number, number][] => {
      if (end <= left || start >= right) return [[left, right]]
      const parts: [number, number][] = []
      if (left < start) parts.push([left, start])
      if (right > end) parts.push([end, right])
      return parts
    })
  }
  if (uncovered.length === 1 && uncovered[0][0] === 0 && uncovered[0][1] === track.width)
    return undefined
  inset = Number.isFinite(inset) ? Math.max(0, inset) : 0
  const rightEdge = Math.max(inset, track.width - inset)
  const bottomEdge = Math.max(inset, track.height - inset)
  const bottom = uncovered.map(([left, right]) => `M${Math.max(inset, left)},${bottomEdge}H${Math.min(rightEdge, right)}`).join('')
  return `M${inset},${bottomEdge}V${inset}H${rightEdge}V${bottomEdge}${bottom}`
}

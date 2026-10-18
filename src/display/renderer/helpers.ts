import { lineDash } from '../../shared/rendering/styles'
import type { WaveformLineStyle } from '../types/data'
export { curveFor } from '../../shared/rendering/styles'
export function dashFor(style: WaveformLineStyle): string | null {
  return lineDash(style, '8 4 2 4') ?? null
}

export function borderDash(style: 'solid' | 'dashed' | 'dotted'): string | null {
  if (style === 'dashed') return '6 4'
  if (style === 'dotted') return '1 3'
  return null
}

/** Builds equal Y-axis intervals while preserving both exact domain endpoints. */
export function yAxisTickValues(domain: [number, number], tickCount = 6): number[] {
  const count = Number.isFinite(tickCount) ? Math.max(2, Math.trunc(tickCount)) : 6
  const [start, end] = domain
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return start
    if (index === count - 1) return end
    return start + ((end - start) * index) / (count - 1)
  })
}

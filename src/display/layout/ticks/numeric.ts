import { niceCoefficient } from '../../../shared/axis/numeric'
import type { Domain } from '../domain/DomainStrategy.js'
import type { TickLayout } from './TickStrategy.js'

export function fallback(domain: Domain): TickLayout {
  return {
    domain: [...domain],
    majorValues: [],
    boundaryValues: [...new Set(domain.filter(Number.isFinite))],
  }
}

export function niceInterval(domain: Domain, count: number, axis: 'x' | 'y'): number | undefined {
  const span = Math.abs(domain[1] - domain[0])
  const density = Number.isFinite(count) && count > 0 ? Math.min(100, count) : axis === 'x' ? 8 : 6
  const divisions =
    axis === 'x' ? Math.max(1, Math.round(density)) : Math.max(1, Math.floor(density) - 1)
  const rough = span / divisions
  if (!Number.isFinite(rough) || rough <= 0) return undefined
  const power = 10 ** Math.floor(Math.log10(rough))
  if (!power) return undefined
  const fraction = rough / power
  const multiple = niceCoefficient(fraction, axis === 'x' ? '1235' : '125')
  const interval = multiple * power
  return Number.isFinite(interval) && interval > 0 ? interval : undefined
}

/** Integer-index generation with bounded allocation; never truncates one side. */
export function generate(domain: Domain, requested?: number): TickLayout {
  const result = fallback(domain)
  if (!domain.every(Number.isFinite) || !requested || !Number.isFinite(requested)) return result
  const low = Math.min(...domain)
  const high = Math.max(...domain)
  let step = requested
  let start = 0
  let end = -1
  for (let attempt = 0; attempt < 8; attempt++) {
    const lo = low / step
    const hi = high / step
    if (
      !Number.isFinite(lo) ||
      !Number.isFinite(hi) ||
      Math.max(Math.abs(lo), Math.abs(hi)) > Number.MAX_SAFE_INTEGER - 2
    )
      return result
    const tolerance = Math.min(1e-7, Number.EPSILON * Math.max(1, Math.abs(lo), Math.abs(hi)) * 4)
    start = Math.ceil(lo - tolerance)
    end = Math.floor(hi + tolerance)
    const count = end - start + 1
    if (count <= 100) break
    step *= Math.max(2, Math.ceil(count / 100))
    if (!Number.isFinite(step)) return result
  }
  if (end - start + 1 > 100) return result
  const digits = Math.max(0, Math.min(100, -Math.floor(Math.log10(step)) + 12))
  const values: number[] = []
  for (let index = start; index <= end; index++) {
    const product = index * step
    // toPrecision handles subnormal scales where toFixed would erase the value.
    const value =
      Math.abs(step) < 1e-90 ? Number(product.toPrecision(15)) : Number(product.toFixed(digits))
    if (!Number.isFinite(value)) return result
    const clean = Object.is(value, -0) ? 0 : value
    if (clean < low || clean > high) continue
    if (values.length && clean <= values[values.length - 1]) return result
    values.push(clean)
  }
  if (domain[0] > domain[1]) values.reverse()
  return { ...result, majorValues: values, interval: step }
}

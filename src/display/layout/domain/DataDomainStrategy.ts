import type { Domain, DomainStrategy } from './DomainStrategy.js'

export class DataDomainStrategy implements DomainStrategy {
  resolve(domain: Domain): Domain {
    return [...domain]
  }
}

/** Applies explicit bounds and the existing empty/constant-domain fallback. */
export function resolveDataDomain(values: readonly number[], min?: number, max?: number): Domain {
  if (!values.length) {
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return min === max ? [min! - 1, max! + 1] : [min!, max!]
    }
    if (Number.isFinite(min)) return [min!, min! + 1]
    if (Number.isFinite(max)) return [max! - 1, max!]
    return [0, 1]
  }
  let low = Infinity
  let high = -Infinity
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    low = Math.min(low, value)
    high = Math.max(high, value)
  }
  let start = Number.isFinite(min) ? min! : Number.isFinite(low) ? low : 0
  let end = Number.isFinite(max) ? max! : Number.isFinite(high) ? high : 1
  if (start === end) {
    start -= 1
    end += 1
  }
  return [start, end]
}

import { tickStep } from 'd3'

/** Match the demo's explicit integer-ms viewport policy, without changing seconds in data. */
export function alignDemoDomain(domain: [number, number]): [number, number] {
  const start = domain[0] * 1000
  const end = domain[1] * 1000
  if (
    !Number.isSafeInteger(Math.ceil(Math.abs(start))) ||
    !Number.isSafeInteger(Math.ceil(Math.abs(end))) ||
    end - start < 1
  )
    return [...domain]
  const step = end - start >= 100 ? Math.max(10, tickStep(start, end, 10) / 10) : 1
  return [(Math.floor(start / step) * step) / 1000, (Math.ceil(end / step) * step) / 1000]
}

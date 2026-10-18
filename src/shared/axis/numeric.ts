export type AxisDomain = [number, number]

/** Numerical quantization is shared; callers retain density, limits and fallback policies. */
export function niceCoefficient(fraction: number, series: '125' | '1235', round = true) {
  if (!round) return fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  if (fraction < 1.5) return 1
  if (fraction < (series === '1235' ? 2.5 : 3)) return 2
  if (series === '1235' && fraction < 4) return 3
  return fraction < 7 ? 5 : 10
}

/** Expands unfixed bounds; fixed flags follow the input order, including reversed axes. */
export function expandDomainToStep(
  domain: AxisDomain,
  step: number,
  fixedStart = false,
  fixedEnd = false,
): AxisDomain {
  const reverse = domain[0] > domain[1]
  const low = Math.min(...domain),
    high = Math.max(...domain)
  const fixedLow = reverse ? fixedEnd : fixedStart
  const fixedHigh = reverse ? fixedStart : fixedEnd
  const start = fixedLow ? low : Math.floor(low / step) * step
  const end = fixedHigh ? high : Math.ceil(high / step) * step
  return reverse ? [end, start] : [start, end]
}

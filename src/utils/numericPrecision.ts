/** Decimal precision of the shortest round-trippable representation. */
export function decimalPrecision(value: number): number {
  const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e')
  return Math.max(0, (coefficient!.split('.')[1]?.length ?? 0) - Number(exponent))
}

/** Remove arithmetic noise only when doing so preserves the visible resolution. */
export function cleanAxisNumber(value: number, domain: [number, number]): number {
  const span = Math.abs(domain[1] - domain[0])
  const cleaned = Number(value.toPrecision(15))
  if (span > 0 && Number.isFinite(span)) {
    if (Number(domain[0].toPrecision(15)) === Number(domain[1].toPrecision(15))) return value
    if (Math.abs(cleaned - value) > span * 1e-6) return value
  }
  return cleaned
}

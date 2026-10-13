/** Compact labels share precision so even extremely close endpoints stay distinct. */
export function formatXAxisNumber(value: number, domain: [number, number]): string {
  if (!Number.isFinite(value)) return String(value)
  const span = Math.abs(domain[1] - domain[0])
  const digits =
    Number.isFinite(span) && span > 0 ? Math.max(0, Math.ceil(-Math.log10(span)) + 1) : 0
  const clean = (number: number) => Number(number.toPrecision(15))
  const fractionalDigits = (number: number) => {
    const text = String(clean(number))
    return text.includes('e') ? 6 : (text.split('.')[1]?.length ?? 0)
  }
  // Wide windows can still have fractional boundaries; do not label 2.76 as 3.
  const precision =
    span >= 1 || span === 0 ? Math.max(digits, Math.min(6, fractionalDigits(value))) : digits
  const fixed = (number: number) => {
    const rounded = Number(clean(number).toFixed(Math.min(6, precision)))
    return Math.abs(rounded) >= 1e21
      ? rounded.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 6 })
      : String(rounded)
  }
  if (
    precision <= 6 &&
    (value === 0 || Number(fixed(value)) !== 0) &&
    (span === 0 || fixed(domain[0]) !== fixed(domain[1]))
  ) {
    return fixed(value)
  }
  for (let significant = 2; significant <= 17; significant++) {
    const scientific = (number: number) => {
      const [mantissa, exponent] = number.toExponential(significant - 1).split('e')
      return `${Number(mantissa)}e${exponent}`
    }
    if (span === 0 || scientific(domain[0]) !== scientific(domain[1])) return scientific(value)
  }
  return value.toExponential(16)
}

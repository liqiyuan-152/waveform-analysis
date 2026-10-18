const formatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 })

export function usesScientificMagnitude(magnitude: number): boolean {
  const value = Math.abs(magnitude)
  return Number.isFinite(value) && (value >= 1000 || (value > 0 && value <= 0.001))
}

export function scientificExponent(min: number, max: number): number | null {
  const magnitude = Math.max(Math.abs(min), Math.abs(max))
  return usesScientificMagnitude(magnitude) ? Math.floor(Math.log10(magnitude)) : null
}

export function scientificExponentText(exponent: number): string {
  return `E${exponent >= 0 ? '+' : '-'}${Math.abs(exponent).toString().padStart(2, '0')}`
}

export function scientificNumber(value: number): string {
  const result = formatter.format(value === 0 ? 0 : Number(value.toPrecision(5)))
  return result === '-0' ? '0' : result
}

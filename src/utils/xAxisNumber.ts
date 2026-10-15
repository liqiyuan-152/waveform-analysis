import { cleanAxisNumber, decimalPrecision } from './numericPrecision'

/** Absolute numeric labels; precision follows the value, not a fixed decimal cap. */
export function formatXAxisNumber(value: number, domain: [number, number]): string {
  if (!Number.isFinite(value)) return String(value)
  const cleaned = cleanAxisNumber(value, domain)
  if (cleaned === 0) return '0'
  const precision = decimalPrecision(cleaned)
  if (precision > 100 || Math.abs(cleaned) >= 1e21) return String(cleaned)
  return cleaned.toFixed(precision)
}

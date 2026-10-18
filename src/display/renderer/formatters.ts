import {
  scientificExponent as resolveScientificExponent,
  scientificExponentText as formatExponent,
  scientificNumber as formatAxisNumber,
} from '../../shared/formatting/scientific'
export { scientificExponent as resolveScientificExponent } from '../../shared/formatting/scientific'

/** Formats numeric ticks using the shared exponent displayed in the axis header. */
export function formatScientificAxisTick(value: number, domain: [number, number]): string {
  if (!Number.isFinite(value)) return String(value)
  const exponent = resolveScientificExponent(domain[0], domain[1])
  return formatAxisNumber(exponent === null ? value : value / 10 ** exponent)
}

export function formatScientificAxisHeader(
  domain: [number, number],
  unit = '',
  unitFirst = true,
): string {
  const exponent = resolveScientificExponent(domain[0], domain[1])
  const trimmedUnit = unit.trim()
  const parts = [trimmedUnit, exponent === null ? '' : formatExponent(exponent)]
  return (unitFirst ? parts : parts.reverse()).filter(Boolean).join('\u00a0\u00a0')
}

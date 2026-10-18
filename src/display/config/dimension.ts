/** Dimensions describe SVG coordinates; the embedding page controls CSS display scaling. */
export function parseDimension(value: unknown): { value: number; percent: boolean } | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) && value > 0 ? { value, percent: false } : undefined
  if (typeof value !== 'string') return undefined
  const match = /^((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|%)?$/i.exec(value.trim())
  if (!match) return undefined
  const number = Number(match[1])
  const percent = match[2] === '%'
  return Number.isFinite(number) && number > 0 && (!percent || number <= 100)
    ? { value: number, percent }
    : undefined
}

export function dimensionPixels(value: number | string, measured: number): number {
  const parsed = parseDimension(value)!
  return parsed.percent ? (measured * parsed.value) / 100 : parsed.value
}

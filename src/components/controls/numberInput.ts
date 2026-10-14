export function stepNumberInput(value: string, direction: 1 | -1, step = 0.001): string {
  const current = Number(value)
  const base = Number.isFinite(current) ? current : 0
  const next = Math.round((base + direction * step) * 1e9) / 1e9
  return Number.isFinite(next) ? String(next) : value
}

import { color, rgb } from 'd3'

export function parseColorValue(value: string) {
  const parsed = color(value)
  if (parsed) return parsed
  // D3's legacy parser only accepts integer RGB channels; CSS also permits fractions.
  const match = /^rgba?\((.+)\)$/i.exec(value)
  const fields = match?.[1].split(',').map((field) => field.trim())
  if (
    !fields ||
    ![3, 4].includes(fields.length) ||
    !fields.every((field) => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?%?$/i.test(field))
  )
    return null
  const numbers = fields.map(
    (field, index) =>
      Number.parseFloat(field) * (field.endsWith('%') ? (index === 3 ? 0.01 : 2.55) : 1),
  )
  return numbers.every(Number.isFinite)
    ? rgb(numbers[0], numbers[1], numbers[2], numbers[3] ?? 1)
    : null
}

export function toHsv(channels: readonly number[]): [number, number, number] {
  const [r, g, b] = channels.map((channel) => channel / 255)
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min
  const hue =
    delta === 0
      ? 0
      : max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4
  return [(hue * 60 + 360) % 360, max === 0 ? 0 : delta / max, max]
}

export function fromHsv(hue: number, saturation: number, value: number): [number, number, number] {
  const c = value * saturation,
    x = c * (1 - Math.abs(((hue / 60) % 2) - 1)),
    m = value - c
  const channels =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x]
  return channels.map((channel) => Math.round((channel + m) * 255)) as [number, number, number]
}

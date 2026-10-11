// D3 uses sans-serif; the axis CSS overrides its text to 11px / 700.
const font = '700 11px sans-serif'
let context: CanvasRenderingContext2D | null | undefined

export function measureYAxisTextWidth(text: string): number {
  if (context === undefined) {
    context =
      typeof document !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined'
        ? document.createElement('canvas').getContext('2d')
        : null
    if (context) context.font = font
  }
  // SSR and DOM-only tests have no canvas. Use conservative widths for the
  // numeric axis alphabet, with the old 7px estimate for other characters.
  const width = context
    ? context.measureText(text).width
    : [...text].reduce(
        (sum, character) => sum + (/[0-9]/.test(character) ? 6.2 : character === '.' ? 3.1 : 7),
        0,
      )
  return Math.ceil(width)
}

/** Lazy, document-scoped canvas ownership; importing the engine remains safe in SSR. */
export class YAxisTextMeasurer {
  private context: CanvasRenderingContext2D | null | undefined

  constructor(private readonly ownerDocument?: Document) {}

  readonly measure = (text: string): number => {
    if (this.context === undefined) {
      const document =
        this.ownerDocument ??
        (typeof globalThis.document === 'undefined' ? undefined : globalThis.document)
      this.context = document?.defaultView?.CanvasRenderingContext2D
        ? document.createElement('canvas').getContext('2d')
        : null
      // Matches D3 axis text after the chart's CSS overrides.
      if (this.context) this.context.font = '700 11px sans-serif'
    }
    const width = this.context
      ? this.context.measureText(text).width
      : [...text].reduce(
          (sum, character) => sum + (/[0-9]/.test(character) ? 6.2 : character === '.' ? 3.1 : 7),
          0,
        )
    return Math.ceil(width)
  }
}

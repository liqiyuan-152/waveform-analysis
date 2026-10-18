interface TextMeasurementBackend {
  width(text: string): number | undefined
  height?(text: string): number | undefined
  destroy?(): void
}

/** The backend owns its document/font; fallback metrics remain a component policy. */
export class TextMeasurer {
  constructor(
    private readonly backend: TextMeasurementBackend,
    private readonly fallbackWidth: (text: string) => number,
    private readonly fallbackHeight = 0,
  ) {}

  private read(text: string, dimension: 'width' | 'height') {
    try {
      const value = this.backend[dimension]?.(text)
      if (value !== undefined && Number.isFinite(value) && value > 0) return value
    } catch {
      // Hidden SVGs and partial DOM environments may expose unusable measurement APIs.
    }
  }

  readonly measure = (text: string): number =>
    text ? (this.read(text, 'width') ?? this.fallbackWidth(text)) : 0

  readonly height = (text: string): number =>
    text ? (this.read(text, 'height') ?? this.fallbackHeight) : 0

  destroy() {
    this.backend.destroy?.()
  }
}

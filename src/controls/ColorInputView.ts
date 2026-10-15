import { color, rgb } from 'd3'

let sequence = 0

function parseColorValue(value: string) {
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

/** A native swatch plus exact CSS text and alpha; untouched values retain their original syntax. */
export class ColorInputView {
  readonly root: HTMLDivElement
  readonly swatch: HTMLInputElement
  readonly text: HTMLInputElement
  readonly alpha: HTMLInputElement
  private readonly error: HTMLElement
  private current: string
  private channels: [number, number, number] = [0, 0, 0]
  private invalid = false
  private disposed = false

  constructor(
    document: Document,
    label: string,
    value: string,
    private readonly changed: () => void,
  ) {
    this.current = value
    this.root = document.createElement('div')
    this.root.className = 'waveform-color-input'
    const input = (type: string, name: string) => {
      const element = document.createElement('input')
      element.type = type
      element.setAttribute('aria-label', name)
      return element
    }
    this.swatch = input('color', label)
    this.text = input('text', `${label}精确值`)
    this.text.spellcheck = false
    this.alpha = input('number', `${label}透明度`)
    this.alpha.min = '0'
    this.alpha.max = '1'
    this.alpha.step = '0.01'
    this.error = document.createElement('small')
    this.error.id = `waveform-native-color-error-${++sequence}`
    this.error.setAttribute('role', 'alert')
    this.error.textContent = '请输入有效颜色和 0 到 1 的透明度'
    const alphaLabel = document.createElement('label')
    alphaLabel.textContent = '透明度'
    alphaLabel.append(this.alpha)
    this.root.append(this.swatch, this.text, alphaLabel, this.error)
    this.hydrate()
    this.text.oninput = () => this.fromText()
    this.swatch.oninput = () => this.fromChannels(true)
    this.alpha.oninput = () => this.fromChannels()
  }

  get value() {
    return this.current
  }
  get valid() {
    return !this.invalid
  }

  private hydrate() {
    this.text.value = this.current
    const parsed = parseColorValue(this.current)
    const value = parsed ? rgb(parsed) : rgb(0, 0, 0)
    let hue = value
    // D3 discards channels at alpha zero. Recover the stated hue before editing alpha.
    if (![hue.r, hue.g, hue.b].every(Number.isFinite)) {
      const hex = /^#([\da-f]{3}|[\da-f]{6})([\da-f]|[\da-f]{2})$/i.exec(this.current)
      const functional = /^(rgba|hsla)\((.+),\s*[^,]+\)$/i.exec(this.current)
      const opaque = hex
        ? `#${hex[1]}`
        : functional
          ? `${functional[1]}(${functional[2]}, 1)`
          : '#000000'
      const recovered = parseColorValue(opaque)
      hue = recovered ? rgb(recovered) : rgb(0, 0, 0)
    }
    this.channels = [hue.r, hue.g, hue.b].map((channel) =>
      Number.isFinite(channel) ? Math.max(0, Math.min(255, channel)) : 0,
    ) as [number, number, number]
    this.swatch.value = rgb(...this.channels).formatHex()
    this.alpha.value = String(value.opacity)
    this.swatch.style.backgroundColor = this.current
    this.validate(false)
  }

  private validate(invalid: boolean) {
    this.invalid = invalid
    this.error.hidden = !invalid
    this.text.setAttribute('aria-invalid', String(invalid))
    this.alpha.setAttribute('aria-invalid', String(invalid))
    for (const input of [this.text, this.alpha]) {
      if (invalid) input.setAttribute('aria-describedby', this.error.id)
      else input.removeAttribute('aria-describedby')
    }
  }

  private fromText() {
    if (this.disposed) return
    const value = this.text.value.trim()
    if (parseColorValue(value)) {
      this.current = value
      this.hydrate()
    } else this.validate(true)
    this.changed()
  }

  private fromChannels(swatchChanged = false) {
    if (this.disposed) return
    if (swatchChanged) {
      const value = rgb(this.swatch.value)
      this.channels = [value.r, value.g, value.b]
    }
    const opacity = Number(this.alpha.value)
    if (!this.alpha.value.trim() || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      this.validate(true)
    } else {
      const channels = this.channels.join(', ')
      this.current = opacity === 1 ? `rgb(${channels})` : `rgba(${channels}, ${opacity})`
      this.text.value = this.current
      this.swatch.style.backgroundColor = this.current
      this.validate(false)
    }
    this.changed()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.text.oninput = this.swatch.oninput = this.alpha.oninput = null
    this.root.remove()
  }
}

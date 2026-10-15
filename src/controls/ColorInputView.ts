import { rgb } from 'd3'
import { parseColorValue, toHsv, fromHsv } from './colorValue'
import { PopupController } from './PopupController'
import { ColorPanel } from './ColorPanel'

let sequence = 0

/** Custom color popup with lossless CSS text and alpha until channels are explicitly edited. */
export class ColorInputView {
  readonly root: HTMLDivElement
  readonly swatch: HTMLButtonElement
  readonly text: HTMLInputElement
  readonly alpha: HTMLInputElement
  readonly alphaSlider: HTMLInputElement
  private readonly error: HTMLElement
  private readonly popup: PopupController
  private readonly panel: ColorPanel
  private hsv: [number, number, number] = [0, 0, 0]
  private opacity = 1
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
    this.root.className = 'waveform-control-theme waveform-color-input'
    const input = (type: string, name: string) => {
      const element = document.createElement('input')
      element.type = type
      element.setAttribute('aria-label', name)
      return element
    }
    this.swatch = document.createElement('button')
    this.swatch.type = 'button'
    this.swatch.className = 'waveform-color-input__trigger'
    this.swatch.setAttribute('aria-label', label)
    this.swatch.setAttribute('aria-haspopup', 'dialog')
    const preview = document.createElement('i')
    preview.setAttribute('aria-hidden', 'true')
    this.swatch.append(preview)
    this.popup = new PopupController(this.swatch, 'waveform-color-popup', 258)
    this.popup.panel.setAttribute('role', 'dialog')
    this.popup.panel.setAttribute('aria-label', `${label}颜色面板`)
    this.swatch.onpointerdown = (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      this.swatch.focus({ preventScroll: true })
    }
    this.swatch.onclick = () => {
      if (this.disposed) return
      if (this.popup.isOpen) this.popup.close()
      else this.popup.open()
    }
    this.swatch.onkeydown = (event) => {
      if (event.key === 'Escape' && this.popup.isOpen) {
        event.preventDefault()
        event.stopPropagation()
        this.popup.close(true)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        this.popup.open()
        this.panel.focus()
      }
    }
    this.text = input('text', `${label}精确值`)
    this.text.spellcheck = false
    this.alphaSlider = input('range', `${label}透明度滑条`)
    this.alphaSlider.min = '0'
    this.alphaSlider.max = '1'
    this.alphaSlider.step = '0.01'
    this.alphaSlider.className = 'waveform-color-panel__alpha'
    this.alpha = input('number', `${label}透明度`)
    this.alpha.min = '0'
    this.alpha.max = '100'
    this.alpha.step = 'any'
    this.error = document.createElement('small')
    this.error.id = `waveform-native-color-error-${++sequence}`
    this.error.setAttribute('role', 'alert')
    this.error.textContent = '请输入有效颜色和 0 到 100 的透明度'
    this.panel = new ColorPanel(
      document,
      label,
      this.text,
      this.alpha,
      this.alphaSlider,
      () => {
        this.validate(true)
        this.changed()
      },
      (hue, saturation, value) => {
        this.hsv = [hue, saturation, value]
        this.channels = fromHsv(...this.hsv)
        this.fromChannels()
      },
      (value) => {
        this.text.value = value
        this.fromText()
      },
    )
    this.popup.panel.append(this.panel.root)
    this.popup.panel.append(this.error)
    this.root.append(this.swatch)
    this.hydrate()
    this.text.oninput = () => this.fromText(true)
    this.text.onblur = () => {
      if (!this.invalid) this.preview()
    }
    this.alpha.oninput = () => this.fromChannels(true)
    this.alphaSlider.oninput = () => {
      this.alpha.value = String(Number(this.alphaSlider.value) * 100)
      this.fromChannels(true)
    }
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
    const hsv = toHsv(this.channels)
    this.hsv = [hsv[1] ? hsv[0] : this.hsv[0], hsv[1], hsv[2]]
    this.opacity = value.opacity
    this.alpha.value = String(Number((value.opacity * 100).toPrecision(15)))
    this.preview()
    this.validate(false)
  }

  private validate(invalid: boolean) {
    this.invalid = invalid
    this.swatch.setAttribute('aria-invalid', String(invalid))
    this.panel.validate(invalid, this.error.id)
    this.error.hidden = !invalid
    this.text.setAttribute('aria-invalid', String(invalid))
    this.alpha.setAttribute('aria-invalid', String(invalid))
    for (const input of [this.text, this.alpha]) {
      if (invalid) input.setAttribute('aria-describedby', this.error.id)
      else input.removeAttribute('aria-describedby')
    }
  }

  private fromText(preserveDraft = false) {
    if (this.disposed) return
    const raw = this.text.value.trim()
    const value = /^[\da-f]{3,8}$/i.test(raw) ? `#${raw}` : raw
    if (parseColorValue(value)) {
      this.current = value
      this.hydrate()
      if (preserveDraft) this.text.value = raw
    } else this.validate(true)
    this.changed()
  }

  private fromChannels(alphaEdited = false) {
    if (this.disposed) return
    const entered = Number(this.alpha.value) / 100
    const opacity = alphaEdited ? entered : this.opacity
    if (!this.alpha.value.trim() || !Number.isFinite(entered) || entered < 0 || entered > 1) {
      this.validate(true)
    } else {
      this.opacity = opacity
      const channels = this.channels.join(', ')
      this.current = opacity === 1 ? `rgb(${channels})` : `rgba(${channels}, ${opacity})`
      this.text.value = this.current
      this.preview()
      this.validate(false)
    }
    this.changed()
  }

  private preview() {
    const preview = this.swatch.firstElementChild as HTMLElement
    preview.style.setProperty('--waveform-swatch-color', this.current)
    this.swatch.title = this.current
    this.swatch.value = rgb(...this.channels).formatHex()
    this.alpha.style.width = `${this.alpha.value.length}ch`
    this.alphaSlider.style.setProperty('--waveform-slider-color', this.current)
    this.alphaSlider.value = String(this.opacity)
    this.alphaSlider.style.setProperty('--waveform-slider-shift', `${this.opacity * 12 - 6}px`)
    this.alphaSlider.style.setProperty(
      '--waveform-color-fill',
      `linear-gradient(to right, transparent, ${rgb(...this.channels).formatHex()})`,
    )
    this.panel.update(this.hsv, this.current, this.channels, this.opacity)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.text.onblur = this.text.oninput = this.alpha.oninput = this.alphaSlider.oninput = null
    this.swatch.onclick = this.swatch.onkeydown = this.swatch.onpointerdown = null
    this.panel.dispose()
    this.popup.dispose()
    this.root.remove()
  }
}

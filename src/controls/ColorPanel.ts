import { fromHsv } from './colorValue'
import { ColorChannels } from './ColorChannels'
import type { NumberInputView } from './NumberInputView'

/** Pointer and keyboard editing for HSV, plus a formatted channel entry. */
export class ColorPanel {
  readonly root: HTMLDivElement
  private readonly area: HTMLDivElement
  private readonly thumb: HTMLElement
  private readonly hue: HTMLInputElement
  private readonly inputs: ColorChannels
  private readonly preview: HTMLElement
  private hsv: [number, number, number] = [0, 0, 0]
  private pointer?: number
  private disposed = false

  constructor(
    document: Document,
    label: string,
    text: HTMLInputElement,
    alpha: NumberInputView,
    alphaSlider: HTMLInputElement,
    invalid: () => void,
    private readonly change: (hue: number, saturation: number, value: number) => void,
    textChange: (value: string) => void,
  ) {
    this.root = document.createElement('div')
    this.root.className = 'waveform-color-panel'
    this.area = document.createElement('div')
    this.area.className = 'waveform-color-panel__area'
    this.area.tabIndex = 0
    this.area.setAttribute('role', 'slider')
    this.area.setAttribute('aria-label', `${label}饱和度和明度`)
    this.area.setAttribute('aria-valuemin', '0')
    this.area.setAttribute('aria-valuemax', '100')
    this.thumb = document.createElement('i')
    this.area.append(this.thumb)
    this.area.onpointerdown = (event) => {
      if (event.button !== 0 || this.disposed) return
      event.preventDefault()
      this.pointer = event.pointerId
      this.area.setPointerCapture?.(event.pointerId)
      this.area.focus()
      this.move(event)
    }
    this.area.onpointermove = (event) => {
      if (event.pointerId === this.pointer) this.move(event)
    }
    this.area.onpointerup = this.area.onpointercancel = () => this.release()
    this.area.onkeydown = (event) => {
      const step = event.shiftKey ? 0.1 : 0.01
      let [, saturation, value] = this.hsv
      if (event.key === 'ArrowLeft') saturation -= step
      else if (event.key === 'ArrowRight') saturation += step
      else if (event.key === 'ArrowUp') value += step
      else if (event.key === 'ArrowDown') value -= step
      else if (event.key === 'Home') saturation = 0
      else if (event.key === 'End') saturation = 1
      else return
      event.preventDefault()
      this.change(
        this.hsv[0],
        Math.max(0, Math.min(1, saturation)),
        Math.max(0, Math.min(1, value)),
      )
    }
    this.hue = document.createElement('input')
    this.hue.type = 'range'
    this.hue.min = '0'
    this.hue.max = '359'
    this.hue.step = '1'
    this.hue.className = 'waveform-color-panel__hue'
    this.hue.setAttribute('aria-label', `${label}色相`)
    this.hue.oninput = () => this.change(Number(this.hue.value), this.hsv[1], this.hsv[2])
    this.inputs = new ColorChannels(document, label, text, alpha, textChange, change, invalid)
    const sliders = document.createElement('div')
    sliders.className = 'waveform-color-panel__sliders'
    const tracks = document.createElement('div')
    tracks.className = 'waveform-color-panel__tracks'
    tracks.append(this.hue, alphaSlider)
    this.preview = document.createElement('div')
    this.preview.className = 'waveform-color-panel__preview'
    this.preview.setAttribute('aria-hidden', 'true')
    sliders.append(tracks, this.preview)
    this.root.append(this.area, sliders, this.inputs.root)
  }

  focus() {
    this.area.focus()
  }

  update(hsv: [number, number, number], color: string, channels: readonly number[], alpha: number) {
    this.hsv = hsv
    this.hue.value = String(hsv[0])
    this.hue.style.setProperty('--waveform-slider-shift', `${(hsv[0] / 359) * 12 - 6}px`)
    const [r, g, b] = fromHsv(hsv[0], 1, 1)
    this.area.style.backgroundColor = `rgb(${r}, ${g}, ${b})`
    this.hue.style.setProperty('--waveform-slider-color', `rgb(${r}, ${g}, ${b})`)
    this.thumb.style.backgroundColor = color
    this.thumb.style.left = `${hsv[1] * 100}%`
    this.thumb.style.top = `${(1 - hsv[2]) * 100}%`
    this.area.setAttribute('aria-valuenow', String(Math.round(hsv[1] * 100)))
    this.area.setAttribute(
      'aria-valuetext',
      `饱和度 ${Math.round(hsv[1] * 100)}%，明度 ${Math.round(hsv[2] * 100)}%`,
    )
    this.preview.style.setProperty('--waveform-color-fill', `linear-gradient(${color}, ${color})`)
    this.inputs.update(hsv, channels, alpha)
  }

  validate(invalid: boolean, errorId: string) {
    this.inputs.validate(invalid, errorId)
  }

  private move(event: PointerEvent) {
    const rect = this.area.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    this.change(
      this.hsv[0],
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)),
    )
  }

  private release() {
    if (this.pointer !== undefined && this.area.hasPointerCapture?.(this.pointer))
      this.area.releasePointerCapture(this.pointer)
    this.pointer = undefined
  }

  dispose() {
    this.disposed = true
    this.release()
    this.inputs.dispose()
    this.area.onpointerdown =
      this.area.onpointermove =
      this.area.onpointerup =
      this.area.onpointercancel =
        null
    this.area.onkeydown = null
    this.hue.oninput = null
  }
}

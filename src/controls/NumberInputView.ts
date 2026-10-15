import { stepNumberInput } from '../components/controls/numberInput'
import { svgNode } from '../rendering/SvgDom'
import { NumberInputHold } from './NumberInputHold'

interface NumberInputState {
  disabled?: boolean
  readOnly?: boolean
}

interface NumberInputOptions {
  compact?: boolean
  step?: number
  shiftStep?: number
  min?: number
  max?: number
}

/** Decimal text input and explicit step buttons share the existing numeric stepping policy. */
export class NumberInputView {
  readonly root: HTMLDivElement
  readonly input: HTMLInputElement
  private disposed = false
  private composing = false
  private readonly hold: NumberInputHold
  private readonly buttons: HTMLButtonElement[] = []

  constructor(
    document: Document,
    label: string,
    private readonly changed: (value: string) => void,
    private readonly commit: () => void,
    private readonly options: NumberInputOptions = {},
  ) {
    this.root = document.createElement('div')
    this.root.className = 'waveform-control-theme waveform-number-input'
    this.root.classList.toggle('waveform-number-input--compact', !!options.compact)
    this.input = document.createElement('input')
    this.input.type = 'text'
    this.input.inputMode = 'decimal'
    this.input.setAttribute('role', 'spinbutton')
    this.input.setAttribute('aria-label', label)
    for (const bound of ['min', 'max'] as const) {
      if (options[bound] !== undefined) {
        this.input[bound] = String(options[bound])
        this.input.setAttribute(`aria-value${bound}`, String(options[bound]))
      }
    }
    this.hold = new NumberInputHold(this.root, this.input, (direction, shift) =>
      this.step(direction, shift),
    )
    const steps = document.createElement('div')
    steps.className = 'waveform-number-input__steps'
    for (const direction of [1, -1] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.tabIndex = -1
      button.setAttribute(
        'aria-label',
        options.compact
          ? direction === 1
            ? '增加数值'
            : '减少数值'
          : direction === 1
            ? '增加时间'
            : '减少时间',
      )
      const icon = svgNode(document, 'svg', { viewBox: '0 0 12 12', 'aria-hidden': 'true' })
      icon.append(
        svgNode(document, 'path', { d: direction === 1 ? 'm1 9 5-6 5 6' : 'm1 3 5 6 5-6' }),
      )
      button.append(icon)
      this.hold.bind(button, direction)
      steps.append(button)
      this.buttons.push(button)
    }
    this.root.append(this.input, steps)
    this.input.addEventListener('input', this.inputEvent)
    this.input.addEventListener('blur', this.blur)
    this.input.addEventListener('keydown', this.keydown)
    this.input.addEventListener('compositionstart', this.compositionStart)
    this.input.addEventListener('compositionend', this.compositionEnd)
    for (const name of ['pointerdown', 'click', 'dblclick', 'wheel', 'contextmenu', 'keydown'])
      this.root.addEventListener(name, this.stop)
  }

  private readonly compositionStart = () => {
    this.composing = true
  }
  private readonly compositionEnd = () => {
    this.composing = false
  }

  private readonly inputEvent = () => {
    if (!this.disposed && !this.input.disabled && !this.input.readOnly)
      this.changed(this.input.value)
  }
  private readonly blur = () => {
    if (!this.disposed && !this.input.disabled && !this.input.readOnly) this.commit()
  }
  private readonly keydown = (event: KeyboardEvent) => {
    if (this.composing || event.isComposing || this.input.disabled || this.input.readOnly) return
    if (event.key === 'Enter') {
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        this.commit()
      }
      return
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    this.step(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey)
  }
  private step(direction: 1 | -1, shift = false) {
    if (this.disposed || this.input.disabled || this.input.readOnly) return
    const next = stepNumberInput(
      this.input.value,
      direction,
      shift ? (this.options.shiftStep ?? 0.01) : (this.options.step ?? 0.001),
    )
    const min = this.input.min === '' ? -Infinity : Number(this.input.min)
    const max = this.input.max === '' ? Infinity : Number(this.input.max)
    this.changed(String(Math.max(min, Math.min(max, Number(next)))))
    this.input.focus()
  }

  private readonly stop = (event: Event) => event.stopPropagation()

  update(value: string, invalid: boolean, description?: string, state: NumberInputState = {}) {
    if (this.disposed) return
    this.input.disabled = !!state.disabled
    this.input.readOnly = !!state.readOnly
    this.root.classList.toggle('is-disabled', this.input.disabled)
    this.root.classList.toggle('is-readonly', this.input.readOnly)
    for (const button of this.buttons) button.disabled = this.input.disabled || this.input.readOnly
    if (this.input.disabled || this.input.readOnly) this.hold.stop()
    if (this.input.value !== value) this.input.value = value
    this.root.classList.toggle('is-invalid', invalid)
    this.input.setAttribute('aria-invalid', String(invalid))
    if (description) this.input.setAttribute('aria-describedby', description)
    else this.input.removeAttribute('aria-describedby')
    if (value.trim() && Number.isFinite(Number(value)))
      this.input.setAttribute('aria-valuenow', String(Number(value)))
    else this.input.removeAttribute('aria-valuenow')
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.hold.dispose()
    this.input.removeEventListener('compositionstart', this.compositionStart)
    this.input.removeEventListener('compositionend', this.compositionEnd)
    for (const name of ['pointerdown', 'click', 'dblclick', 'wheel', 'contextmenu', 'keydown'])
      this.root.removeEventListener(name, this.stop)
    this.input.removeEventListener('input', this.inputEvent)
    this.input.removeEventListener('blur', this.blur)
    this.input.removeEventListener('keydown', this.keydown)
    for (const button of this.buttons) {
      button.onpointerdown = button.onpointerleave = null
      button.onclick = null
      button.onmousedown = null
    }
    this.root.remove()
  }
}

import { stepNumberInput } from '../components/controls/numberInput'
import { svgNode } from '../rendering/SvgDom'

/** Decimal text input and explicit step buttons share the existing numeric stepping policy. */
export class NumberInputView {
  readonly root: HTMLDivElement
  readonly input: HTMLInputElement
  private disposed = false
  private readonly buttons: HTMLButtonElement[] = []

  constructor(
    document: Document,
    label: string,
    private readonly changed: (value: string) => void,
    private readonly commit: () => void,
  ) {
    this.root = document.createElement('div')
    this.root.className = 'waveform-number-input'
    this.input = document.createElement('input')
    this.input.type = 'text'
    this.input.inputMode = 'decimal'
    this.input.setAttribute('role', 'spinbutton')
    this.input.setAttribute('aria-label', label)
    const steps = document.createElement('div')
    steps.className = 'waveform-number-input__steps'
    for (const direction of [1, -1] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('aria-label', direction === 1 ? '增加时间' : '减少时间')
      const icon = svgNode(document, 'svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' })
      icon.append(
        svgNode(document, 'path', { d: direction === 1 ? 'm3 10 5-5 5 5' : 'm3 6 5 5 5-5' }),
      )
      button.append(icon)
      button.onmousedown = (event) => event.preventDefault()
      button.onclick = () => this.step(direction)
      steps.append(button)
      this.buttons.push(button)
    }
    this.root.append(this.input, steps)
    this.input.addEventListener('input', this.inputEvent)
    this.input.addEventListener('blur', this.blur)
    this.input.addEventListener('keydown', this.keydown)
  }

  private readonly inputEvent = () => {
    if (!this.disposed) this.changed(this.input.value)
  }
  private readonly blur = () => {
    if (!this.disposed) this.commit()
  }
  private readonly keydown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    this.step(event.key === 'ArrowUp' ? 1 : -1)
  }
  private step(direction: 1 | -1) {
    if (this.disposed) return
    this.changed(stepNumberInput(this.input.value, direction))
    this.input.focus()
  }

  update(value: string, invalid: boolean, description?: string) {
    if (this.disposed) return
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
    this.input.removeEventListener('input', this.inputEvent)
    this.input.removeEventListener('blur', this.blur)
    this.input.removeEventListener('keydown', this.keydown)
    for (const button of this.buttons) {
      button.onclick = null
      button.onmousedown = null
    }
    this.root.remove()
  }
}

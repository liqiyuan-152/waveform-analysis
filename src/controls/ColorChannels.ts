import { SelectView } from './SelectView'

/** Compact Ant Design color format/channel row; switching format never mutates the color. */
export class ColorChannels {
  readonly root: HTMLDivElement
  private readonly format: SelectView
  private readonly hex: HTMLLabelElement
  private readonly group: HTMLDivElement
  private readonly fields: HTMLInputElement[] = []
  private mode = 'hex'
  private hsv: readonly number[] = [0, 0, 0]
  private channels: readonly number[] = [0, 0, 0]
  private opacity = 1

  constructor(
    document: Document,
    label: string,
    private readonly text: HTMLInputElement,
    alpha: HTMLInputElement,
    private readonly textChange: (value: string) => void,
    private readonly hsvChange: (h: number, s: number, v: number) => void,
    private readonly invalid: () => void,
  ) {
    this.root = document.createElement('div')
    this.root.className = 'waveform-color-panel__format'
    this.format = new SelectView(
      document,
      `${label}颜色格式`,
      (value) => {
        this.mode = value
        this.format.update(this.formats, value)
        this.display()
      },
      'compact',
    )
    this.format.update(this.formats, this.mode)
    this.hex = document.createElement('label')
    this.hex.className = 'waveform-color-panel__hex waveform-color-panel__field'
    const prefix = document.createElement('span')
    prefix.textContent = '#'
    this.hex.append(prefix, text)
    this.group = document.createElement('div')
    this.group.className = 'waveform-color-panel__channels'
    for (let index = 0; index < 3; index++) {
      const field = document.createElement('input')
      field.type = 'number'
      field.min = '0'
      field.step = 'any'
      field.oninput = () => {
        const values = this.fields.map((input) => Number(input.value))
        if (this.fields.some((input) => input.value === '' || !input.checkValidity())) {
          this.invalid()
        } else if (this.mode === 'rgb') {
          this.textChange(`rgba(${values.join(', ')}, ${this.opacity})`)
        } else this.hsvChange(values[0], values[1] / 100, values[2] / 100)
      }
      const wrapper = document.createElement('label')
      wrapper.className = 'waveform-color-panel__field'
      wrapper.append(field)
      this.group.append(wrapper)
      this.fields.push(field)
    }
    const alphaField = document.createElement('label')
    alphaField.className = 'waveform-color-panel__field waveform-color-panel__opacity'
    const suffix = document.createElement('span')
    suffix.textContent = '%'
    alphaField.append(alpha, suffix)
    this.root.append(this.format.root, this.hex, this.group, alphaField)
  }

  private readonly formats = [
    { value: 'hex', label: 'HEX' },
    { value: 'hsb', label: 'HSB' },
    { value: 'rgb', label: 'RGB' },
  ]

  update(hsv: readonly number[], channels: readonly number[], alpha: number) {
    this.hsv = hsv
    this.channels = channels
    this.opacity = alpha
    this.display()
  }

  private display() {
    this.hex.hidden = this.mode !== 'hex'
    this.group.hidden = this.mode === 'hex'
    this.text.value = this.channels
      .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    this.fields.forEach((field, index) => {
      const hsb = this.mode === 'hsb'
      field.max = String(hsb ? (index === 0 ? 360 : 100) : 255)
      field.setAttribute('aria-label', `${(hsb ? ['H', 'S', 'B'] : ['R', 'G', 'B'])[index]}通道`)
      field.value = String(
        hsb ? Math.round(this.hsv[index] * (index ? 100 : 1)) : this.channels[index],
      )
      const wrapper = field.parentElement!
      wrapper.querySelector('span')?.remove()
      if (hsb && index) {
        const suffix = field.ownerDocument.createElement('span')
        suffix.textContent = '%'
        wrapper.append(suffix)
      }
    })
  }

  validate(invalid: boolean, errorId: string) {
    for (const input of [this.text, ...this.fields]) {
      input.setAttribute('aria-invalid', String(invalid))
      if (invalid) input.setAttribute('aria-describedby', errorId)
      else input.removeAttribute('aria-describedby')
    }
  }

  dispose() {
    this.format.dispose()
    for (const field of this.fields) field.oninput = null
  }
}

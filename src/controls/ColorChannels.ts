import { SelectView } from './SelectView'
import { NumberInputView } from './NumberInputView'

/** Compact Ant Design color format/channel row; switching format never mutates the color. */
export class ColorChannels {
  readonly root: HTMLDivElement
  private readonly format: SelectView
  private readonly hex: HTMLLabelElement
  private readonly group: HTMLDivElement
  private readonly fields: NumberInputView[] = []
  private mode = 'hex'
  private hsv: readonly number[] = [0, 0, 0]
  private channels: readonly number[] = [0, 0, 0]
  private opacity = 1

  constructor(
    document: Document,
    label: string,
    private readonly text: HTMLInputElement,
    private readonly alpha: NumberInputView,
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
      const field = new NumberInputView(
        document,
        '颜色通道',
        (value) => {
          field.input.value = value
          const values = this.fields.map((view) => Number(view.input.value))
          if (
            this.fields.some(
              ({ input }) =>
                !input.value.trim() ||
                !Number.isFinite(Number(input.value)) ||
                Number(input.value) < 0 ||
                Number(input.value) > Number(input.max),
            )
          )
            this.invalid()
          else if (this.mode === 'rgb') {
            this.textChange(`rgba(${values.join(', ')}, ${this.opacity})`)
          } else this.hsvChange(values[0], values[1] / 100, values[2] / 100)
        },
        () => {},
        { compact: true, step: 1, shiftStep: 10, min: 0, max: 255 },
      )
      const suffix = document.createElement('span')
      suffix.className = 'waveform-color-panel__suffix'
      suffix.textContent = '%'
      field.root.append(suffix)
      this.group.append(field.root)
      this.fields.push(field)
    }
    const alphaField = alpha.root
    alphaField.classList.add('waveform-color-panel__opacity')
    const suffix = document.createElement('span')
    suffix.className = 'waveform-color-panel__suffix'
    suffix.textContent = '%'
    alphaField.append(suffix)
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
    this.fields.forEach((view, index) => {
      const hsb = this.mode === 'hsb'
      const max = hsb ? (index === 0 ? 360 : 100) : 255
      view.input.max = String(max)
      view.input.setAttribute('aria-valuemax', String(max))
      view.input.setAttribute(
        'aria-label',
        `${(hsb ? ['H', 'S', 'B'] : ['R', 'G', 'B'])[index]}通道`,
      )
      view.update(
        String(hsb ? Math.round(this.hsv[index] * (index ? 100 : 1)) : this.channels[index]),
        false,
      )
      const suffix = view.root.querySelector<HTMLElement>('.waveform-color-panel__suffix')!
      suffix.hidden = !hsb || index === 0
    })
    this.alpha.update(this.alpha.input.value, false)
  }

  validate(invalid: boolean, errorId: string) {
    for (const view of [...this.fields, this.alpha]) {
      view.update(view.input.value, invalid, invalid ? errorId : undefined)
    }
    for (const input of [this.text]) {
      input.setAttribute('aria-invalid', String(invalid))
      if (invalid) input.setAttribute('aria-describedby', errorId)
      else input.removeAttribute('aria-describedby')
    }
  }

  dispose() {
    this.format.dispose()
    for (const field of this.fields) field.dispose()
  }
}

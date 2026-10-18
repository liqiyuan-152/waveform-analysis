import type { ControlTheme } from '../controls/theme'
import { ColorInputView } from '../controls/ColorInputView'
import { resolveAnnotationStyle } from './markup'
import type { WaveformAnnotationStyle } from '../types/chart'

/** Owns the three style controls without mutating the controlled annotation draft. */
export class AnnotationStyleEditor {
  readonly root: HTMLFieldSetElement
  private readonly controls: Record<keyof Required<WaveformAnnotationStyle>, ColorInputView>

  constructor(document: Document, style: WaveformAnnotationStyle | undefined, changed: () => void) {
    this.root = document.createElement('fieldset')
    this.root.className = 'waveform-annotation-editor__colors'
    const legend = document.createElement('legend')
    legend.textContent = '颜色与透明度'
    this.root.append(legend)
    const resolved = resolveAnnotationStyle(style)
    const control = (key: keyof typeof resolved, label: string) => {
      const field = document.createElement('div')
      field.className = 'waveform-annotation-editor__color-field'
      const title = document.createElement('span')
      title.textContent = label
      const input = new ColorInputView(document, `标注${label}`, resolved[key], changed)
      field.append(title, input.root)
      this.root.append(field)
      return input
    }
    this.controls = {
      borderColor: control('borderColor', '边框色'),
      textColor: control('textColor', '文字色'),
      backgroundColor: control('backgroundColor', '背景色'),
    }
  }

  setTheme(theme: ControlTheme) {
    for (const control of Object.values(this.controls)) control.setTheme(theme)
  }

  get valid() {
    return Object.values(this.controls).every((control) => control.valid)
  }

  snapshot() {
    return {
      borderColor: this.controls.borderColor.value,
      textColor: this.controls.textColor.value,
      backgroundColor: this.controls.backgroundColor.value,
    }
  }

  dispose() {
    for (const control of Object.values(this.controls)) control.dispose()
    this.root.remove()
  }
}

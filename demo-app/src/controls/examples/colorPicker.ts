import { ColorPicker } from 'waveform-analysis/color-picker'
import 'waveform-analysis/color-picker/style.css'
import { createExample } from '../example'

export function mount(host: HTMLElement, report: (message: string) => void) {
  const demo = createExample(host)
  for (const [title, value] of [
    ['基本颜色', '#1677ff'],
    ['带透明度的颜色', 'rgba(22, 119, 255, 0.5)'],
  ]) {
    const card = demo.section(
      title,
      '点击色块编辑 HEX、RGB、HSB 和透明度；无效输入会显示错误状态。',
    )
    const output = demo.document.createElement('p')
    const picker = demo.own(
      new ColorPicker(demo.document, title, value, () => {
        output.textContent = `${picker.value} · ${picker.valid ? '有效' : '输入无效'}`
        report(output.textContent)
      }),
    )
    output.textContent = `${picker.value} · 有效`
    card.append(picker.root, output)
  }
  return demo
}

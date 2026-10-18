import { Select } from 'waveform-analysis/select'
import 'waveform-analysis/select/style.css'
import { createExample } from '../example'

export function mount(host: HTMLElement, report: (message: string) => void) {
  const demo = createExample(host)
  const options = [
    { value: 'a', label: '选项 A' },
    { value: 'b', label: '选项 B' },
    { value: 'c', label: '禁用选项', disabled: true },
  ]
  for (const [title, value, disabled, variant] of [
    ['基本选择', 'a', false, 'default'],
    ['占位符', '', false, 'default'],
    ['整体禁用', 'a', true, 'default'],
    ['紧凑模式', 'b', false, 'compact'],
  ] as const) {
    const select = demo.own(
      new Select(
        demo.document,
        title,
        (next) => {
          select.update(options, next, disabled)
          report(`${title}：${next}`)
        },
        variant,
      ),
    )
    select.update(options, value, disabled, '请选择一个选项')
    demo
      .section(title, '支持方向键、Enter 选择、Escape 关闭和键入搜索；选项 C 不可选择。')
      .append(select.root)
  }
  return demo
}

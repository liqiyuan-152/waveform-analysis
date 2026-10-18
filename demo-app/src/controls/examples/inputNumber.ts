import { InputNumber } from 'waveform-analysis/input-number'
import 'waveform-analysis/input-number/style.css'
import { createExample } from '../example'

export function mount(host: HTMLElement, report: (message: string) => void) {
  const demo = createExample(host)
  const basic = demo.section(
    '基本输入与范围',
    '范围 0–100，步长 1；按住 Shift 时步长为 10。回车或失焦提交。',
  )
  const input = demo.own(
    new InputNumber(
      demo.document,
      '数量',
      (value) => {
        input.update(
          value,
          !value.trim() ||
            !Number.isFinite(Number(value)) ||
            Number(value) < 0 ||
            Number(value) > 100,
        )
        report(`输入草稿：${value}`)
      },
      () => report(`提交数值：${input.input.value}`),
      { min: 0, max: 100, step: 1, shiftStep: 10 },
    ),
  )
  input.update('10', false)
  basic.append(input.root)
  for (const [title, value, state, invalid] of [
    ['只读', '42', { readOnly: true }, false],
    ['禁用', '20', { disabled: true }, false],
    ['错误状态', 'invalid', {}, true],
  ] as const) {
    const field = demo.own(
      new InputNumber(
        demo.document,
        title,
        (next) => field.update(next, !Number.isFinite(Number(next))),
        () => {},
      ),
    )
    field.update(value, invalid, undefined, state)
    demo.section(title, '使用 update() 设置输入值与状态。').append(field.root)
  }
  return demo
}

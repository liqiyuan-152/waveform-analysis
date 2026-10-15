import { NumberInputView } from '../../src/controls/NumberInputView'
import { SelectView } from '../../src/controls/SelectView'
import '../../src/styles/native.css'

const host = document.querySelector<HTMLElement>('#controls')!
const controls: Array<{ dispose: () => void }> = []
const values: string[] = []
let gestures = 0
const number = (label: string, value: string, invalid = false, state = {}) => {
  const view = new NumberInputView(
    document,
    label,
    (value) => {
      values.push(value)
      view.update(value, false)
    },
    () => {},
  )
  view.update(value, invalid, undefined, state)
  host.append(view.root)
  controls.push(view)
  return view
}
let options = [
  { value: 'a', label: 'Channel a' },
  { value: 'b', label: 'Disabled channel', disabled: true },
  { value: 'c', label: 'Channel c' },
]
const select = (label: string, value: string, disabled = false) => {
  const view = new SelectView(document, label, (value) => view.update(options, value))
  view.update(options, value, disabled, 'Please select')
  host.append(view.root)
  controls.push(view)
  return view
}
const time = number('时间', '1000')
const primary = select('波形', 'a')
const long = select('长标签', 'a')
long.update([{ value: 'a', label: 'A very long channel label that should be truncated' }], 'a')
select('占位选择', '')
select('禁用选择', 'a', true)
number('错误数字', '1000', true)
number('禁用数字', '1000', false, { disabled: true })
number('只读数字', '1000', false, { readOnly: true })
for (const name of ['pointerdown', 'click', 'wheel', 'keydown'])
  host.addEventListener(name, () => gestures++)
Object.assign(window, {
  nativeInputSelect: {
    values,
    many: () => {
      options = Array.from({ length: 50 }, (_, index) => ({
        value: String(index),
        label: `Option ${index}`,
        disabled: false,
      }))
      primary.update(options, '0')
    },
    gestures: () => gestures,
    hide: () => {
      time.root.hidden = true
    },
    dispose: () => controls.forEach((view) => view.dispose()),
  },
})

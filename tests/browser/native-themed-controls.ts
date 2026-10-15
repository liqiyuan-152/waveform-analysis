import { init } from '../../src/native'
import { SelectView } from '../../src/controls/SelectView'
import { NumberInputView } from '../../src/controls/NumberInputView'
import '../../src/styles/native.css'

const chart = init(document.querySelector<HTMLElement>('#chart')!, {
  width: Math.min(1200, window.innerWidth),
  height: 440,
  displayMode: 'independent',
  grid: { rowCount: 2, columnCount: 1 },
  toolbar: { display: 'always' },
  animationEnabled: false,
  data: {
    kind: 'series',
    series: ['a', 'b'].map((id) => ({
      id,
      name: `Channel ${id}`,
      data: { kind: 'samples', sampleRate: 1, values: [0, 1, 0, -1, 0] },
    })),
  },
  annotations: [
    {
      id: 'note',
      seriesId: 'a',
      x: 1,
      y: 1,
      text: '原生颜色与输入',
      style: {
        borderColor: '#12345600',
        textColor: '#333333',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
      },
    },
  ],
})
const replacements: unknown[] = []
let gestures = 0
chart.on('update:annotations', (annotations) => replacements.push(annotations))
chart.on('zoom-intent', () => gestures++)
const states = document.querySelector<HTMLElement>('#states')!
const disabled = new SelectView(document, '禁用选择', () => {})
disabled.update([{ value: 'a', label: 'Disabled select' }], 'a', true)
const number = new NumberInputView(
  document,
  '错误数字输入',
  () => {},
  () => {},
)
number.update('invalid', true)
states.append(disabled.root, number.root)
Object.assign(window, {
  themedControls: {
    chart,
    replacements,
    gestures: () => gestures,
    dispose: () => {
      chart.dispose()
      disabled.dispose()
      number.dispose()
    },
  },
})

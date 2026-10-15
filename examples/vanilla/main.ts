import 'waveform-analysis/native/style.css'
import '../shared/style.css'
import { exampleData } from '../shared/data'
import { diagnostics } from '../shared/diagnostics'
import { VanillaWaveformDemo } from './VanillaWaveformDemo'

const app = document.getElementById('app')!
app.innerHTML = '<h1>Vanilla DOM 示例</h1><div class="example-controls"></div>'
const controls = app.querySelector('.example-controls')!
let chart: VanillaWaveformDemo | undefined
let second: VanillaWaveformDemo | undefined
let version = 0
let callbackVersion = 0
let narrow = false

function create() {
  // This stable subscription reads the current host callback state on every event.
  const demo = new VanillaWaveformDemo(app, exampleData(version), () =>
    diagnostics.rendered(callbackVersion),
  )
  demo.resize(narrow)
  return demo
}

function button(text: string, action: () => void) {
  const button = document.createElement('button')
  button.textContent = text
  button.addEventListener('click', action)
  controls.append(button)
}

button('替换数据', () => {
  version++
  chart?.setData(exampleData(version))
  second?.setData(exampleData(version))
})
button('更新回调', () => callbackVersion++)
button('切换宽度', () => {
  narrow = !narrow
  chart?.resize(narrow)
  second?.resize(narrow)
})
button('挂载 / 卸载', () => {
  if (chart) {
    chart.dispose()
    chart = undefined
  } else chart = create()
})
button('第二个图表', () => {
  if (second) {
    second.dispose()
    second = undefined
  } else second = create()
})
chart = create()
window.addEventListener(
  'pagehide',
  () => {
    chart?.dispose()
    second?.dispose()
  },
  { once: true },
)

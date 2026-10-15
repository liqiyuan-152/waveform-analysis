import { createApp, h, shallowRef, type App } from 'vue'
import { init, getInstanceByDom, type WaveformChartInstance } from '../../src/native'
import WaveformChart from '../../src/adapters/vue/WaveformChart.vue'
import type { WaveformChartProps, WaveformChartOptions } from '../../src/types/options'
import type { WaveformChartHandle } from '../../src/types/controls'
import type { WaveformDisplayMode } from '../../src/types/chart'
import '../../src/styles/native.css'

let app: App | undefined
let native: WaveformChartInstance | undefined
const ref = shallowRef<WaveformChartHandle>()
const options = shallowRef<WaveformChartProps>()
let oldListenerCalls = 0
let newListenerCalls = 0
const latest = shallowRef(false)
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame)
}
function dispose() {
  const host = document.querySelector<HTMLElement>('#vue .waveform-chart-host')
  const instance = host && getInstanceByDom(host)
  app?.unmount()
  native?.dispose()
  app = undefined
  native = undefined
  return {
    disposed: instance?.isDisposed(),
    registered: host ? !!getInstanceByDom(host) : false,
    remaining: document.querySelectorAll('.waveform-chart').length,
  }
}
async function setup(width: number, displayMode: WaveformDisplayMode) {
  dispose()
  document.body.replaceChildren()
  oldListenerCalls = newListenerCalls = 0
  latest.value = false
  const data = {
    kind: 'series' as const,
    series: ['a', 'b'].map((id) => ({
      id,
      name: `通道 ${id}`,
      data: {
        kind: 'points' as const,
        points: Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: Math.sin(i / 10) })),
      },
    })),
  }
  options.value = {
    data,
    width,
    height: 400,
    displayMode,
    animationEnabled: false,
    toolbar: { display: 'always' },
    pannable: true,
    interactionMode: 'zoom',
    title: { text: 'Vue 薄适配中文标题' },
    grid: { rowCount: 1, columnCount: 1 },
    rendering: { sampling: { mode: 'raw' } },
  }
  for (const id of ['native', 'vue']) {
    const host = document.createElement('div')
    host.id = id
    document.body.append(host)
  }
  native = init(document.getElementById('native')!, options.value)
  app = createApp({
    render: () =>
      h(WaveformChart, {
        ...options.value!,
        ref,
        'onZoom-end': latest.value ? () => newListenerCalls++ : () => oldListenerCalls++,
      }),
  })
  app.mount(document.getElementById('vue')!)
  await settle()
}
async function patch(patch: WaveformChartOptions) {
  native!.setOption(patch)
  options.value = { ...options.value!, ...patch, data: patch.data ?? options.value!.data }
  await settle()
}
function snapshot(id: string) {
  const root = document.querySelector<HTMLElement>(`#${id} .waveform-chart`)!
  const origin = root.getBoundingClientRect()
  return {
    state: id === 'native' ? native!.getControlState() : ref.value!.getControlState(),
    text: root.querySelector('.waveform-chart__title-text')?.textContent,
    paths: [...root.querySelectorAll('.waveform-chart__line')].map((node) => ({
      d: node.getAttribute('d'),
      stroke: node.getAttribute('stroke'),
    })),
    bounds: [...root.querySelectorAll('.waveform-chart__plot-frame')].map((node) => {
      const box = node.getBoundingClientRect()
      return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height }
    }),
  }
}
Object.assign(globalThis, {
  vueAdapterProbe: {
    setup,
    patch,
    settle,
    dispose,
    snapshot,
    replaceListener: async () => {
      latest.value = true
      await settle()
    },
    listenerCalls: () => ({ old: oldListenerCalls, next: newListenerCalls }),
    export: async () => ({ svg: await (await ref.value!.exportImage({ format: 'svg' })).text() }),
  },
})

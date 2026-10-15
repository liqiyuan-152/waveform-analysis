import { createApp, h, nextTick, shallowRef } from 'vue'
import VueChart from '../support/LegacyWaveformChart.vue'
import { init } from '@/chart/init'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformData } from '@/types/data'
import type { WaveformChartHandle } from '@/types/controls'
import '@/styles/native.css'

const options = shallowRef<WaveformChartOptions & { data: WaveformData }>({
  width: 360,
  height: 400,
  animationEnabled: false,
  grid: { rowCount: 1, columnCount: 1 },
  rendering: { sampling: { mode: 'raw' } },
  data: {
    kind: 'series',
    series: Array.from({ length: 12 }, (_, index) => ({
      id: `page-${index}`,
      name: `分页通道 ${index + 1}`,
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    })),
  },
})
const vueHost = document.getElementById('vue')!
const nativeHost = document.getElementById('native')!
let vue: WaveformChartHandle
createApp({
  render: () =>
    h(VueChart, {
      ...options.value,
      ref: (instance: unknown) => {
        vue = instance as WaveformChartHandle
      },
    }),
}).mount(vueHost)
const native = init(nativeHost, options.value)

async function stable() {
  await nextTick()
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
  await Promise.all([vue.exportImage({ format: 'svg' }), native.exportImage({ format: 'svg' })])
}
function bounds(host: HTMLElement) {
  const root = host.getBoundingClientRect()
  const box = (selector: string) => {
    const node = host.querySelector(selector)!
    const rect = node.getBoundingClientRect()
    return { x: rect.x - root.x, y: rect.y - root.y, width: rect.width, height: rect.height }
  }
  const label = box('.waveform-chart__x-label')
  const pagination = box('.waveform-pagination')
  return {
    label,
    pagination,
    svg: box('svg.waveform-chart__svg'),
    overlap:
      label.x < pagination.x + pagination.width &&
      pagination.x < label.x + label.width &&
      label.y < pagination.y + pagination.height &&
      pagination.y < label.y + label.height,
  }
}
const api = {
  async compare(layoutPreset: 'default' | 'edge-compact') {
    options.value = { ...options.value, layoutPreset }
    native.setOption({ layoutPreset })
    await stable()
    for (const host of [vueHost, nativeHost])
      host.querySelector<HTMLButtonElement>('[aria-label="第 1 页"]')!.click()
    await stable()
    for (const host of [vueHost, nativeHost])
      host.querySelector<HTMLButtonElement>('[aria-label="向后 5 页"]')!.click()
    await stable()
    return { layoutPreset, vue: bounds(vueHost), native: bounds(nativeHost) }
  },
}
declare global {
  interface Window {
    paginationParity: typeof api
  }
}
window.paginationParity = api

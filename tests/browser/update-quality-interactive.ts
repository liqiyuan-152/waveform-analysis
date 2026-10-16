import { createApp, h, nextTick, reactive } from 'vue'
import { init, getInstanceByDom } from '@/native'
import WaveformChart from '@/adapters/vue/WaveformChart.vue'
import type { WaveformChartOptions, WaveformChartOptionUpdate } from '@/types/options'
import type { WaveformChartInstance } from '@/types/native'

let chart: WaveformChartInstance | undefined
let patchOptions: ((patch: WaveformChartOptionUpdate) => Promise<void>) | undefined
let cleanup: (() => void) | undefined
const requests: string[][] = []

export async function startInteractive(vue: boolean, width: number) {
  cleanup?.()
  const host = document.getElementById('benchmark')!
  host.style.width = `${width}px`
  host.style.height = '480px'
  requests.length = 0
  const options: WaveformChartOptions = {
    width,
    height: 480,
    animationEnabled: false,
    data: {
      kind: 'series',
      series: ['a', 'b'].map((id, index) => ({
        id,
        name: `通道 ${id.toUpperCase()}`,
        trackId: 'group',
        data: {
          kind: 'samples',
          sampleRate: 1000,
          values: Array.from({ length: 10_000 }, (_, i) => Math.sin(i / 50) + index),
        },
      })),
    },
    grid: { rowCount: 1, columnCount: 1 },
    legend: { interactive: true, position: 'top' },
    hiddenSeriesIds: [],
    pannable: true,
    toolbar: true,
    annotations: [{ id: 'note', seriesId: 'a', x: 1, y: 0.9, text: '浏览器标注' }],
    rendering: { sampling: { mode: 'auto', autoThreshold: 100, maxPointCount: 1200 } },
    xDomainStrategy: { type: 'data' },
  }
  if (vue) {
    const props = reactive(options)
    const app = createApp({ render: () => h(WaveformChart, { ...props, data: props.data! }) })
    app.mount(host)
    chart = getInstanceByDom(host.firstElementChild as HTMLElement)!
    patchOptions = async (patch) => {
      Object.assign(props, patch)
      await nextTick()
    }
    cleanup = () => app.unmount()
  } else {
    chart = init(host, options)
    patchOptions = async (patch) => {
      chart!.setOption(patch)
    }
    cleanup = () => chart?.dispose()
  }
  chart.on('update:hidden-series-ids', (ids) => requests.push(ids))
  await chart.exportImage({ format: 'svg' })
}

export const interactive = {
  patch: async (patch: WaveformChartOptionUpdate) => {
    await patchOptions!(patch)
    await chart!.exportImage({ format: 'svg' })
  },
  requests: () => requests,
  state: () => chart!.getControlState(),
  zoom: () => chart!.zoomIn(),
  reset: () => chart!.resetViewport(),
  svg: async () => (await chart!.exportImage({ format: 'svg' })).text(),
  pngSize: async () => (await chart!.exportImage({ format: 'png' })).size,
}

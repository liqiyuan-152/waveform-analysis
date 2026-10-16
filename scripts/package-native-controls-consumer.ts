import { createApp, defineComponent, h, ref } from 'vue'
import { WaveformChart } from 'waveform-analysis/vue'
import {
  init,
  getInstanceByDom,
  dispose,
  type WaveformAnnotation,
  type WaveformData,
  initializeWasmSampling,
  sampleWaveformWasm,
} from 'waveform-analysis'
import {
  init as nativeInit,
  getInstanceByDom as nativeGet,
  dispose as nativeDispose,
} from 'waveform-analysis/native'
import 'waveform-analysis/style.css'

function verifyNativeEntryIdentity() {
  if (init !== nativeInit || getInstanceByDom !== nativeGet || dispose !== nativeDispose)
    throw new Error('Native entry functions differ')
  const host = document.createElement('div')
  document.body.append(host)
  const options = { width: 300, height: 180, animationEnabled: false }
  try {
    const chart = init(host, options, { autoResize: false })
    if (nativeInit(host) !== chart || nativeGet(host) !== chart)
      throw new Error('Native alias cannot find the root instance')
    nativeDispose(host)
    if (!chart.isDisposed() || getInstanceByDom(host))
      throw new Error('Cross-entry disposal failed')
    const aliasChart = nativeInit(host, options, { autoResize: false })
    if (init(host) !== aliasChart || getInstanceByDom(host) !== aliasChart)
      throw new Error('Root cannot find the native alias instance')
    dispose(aliasChart)
    if (!aliasChart.isDisposed() || nativeGet(host))
      throw new Error('Reverse cross-entry disposal failed')
    return true
  } finally {
    dispose(host)
    host.remove()
  }
}
const nativeEntryIdentity = verifyNativeEntryIdentity()

const annotations = ref<WaveformAnnotation[]>([])
const width = ref(800)
const events: unknown[] = []
const data: WaveformData = {
  kind: 'series',
  series: Array.from({ length: 12 }, (_, i) => ({
    id: `s${i}`,
    name: `Channel ${i}`,
    data: { kind: 'samples', values: [0, 2, 1], sampleRate: 1 },
  })),
}
const app = createApp(
  defineComponent({
    setup() {
      return () =>
        h(WaveformChart, {
          data,
          width: width.value,
          height: 400,
          displayMode: 'independent',
          animationEnabled: false,
          interactionMode: 'annotation',
          grid: { rowCount: 1, columnCount: 1 },
          annotations: annotations.value,
          'onUpdate:annotations': (value: WaveformAnnotation[]) => {
            annotations.value = value
          },
          onAnnotationCreate: (value: WaveformAnnotation) => events.push(['create', value]),
          onAnnotationUpdate: (value: WaveformAnnotation) => events.push(['update', value]),
          onPageChange: (value: number) => events.push(['page', value]),
        })
    },
  }),
)
app.mount('#chart')
Object.assign(window, {
  packageControls: {
    nativeEntryIdentity,
    verifyWasm: async () => {
      await initializeWasmSampling()
      const result = await sampleWaveformWasm({
        x: new Float64Array([0, 1, 2, 3]),
        y: new Float64Array([1, 9, -7, 2]),
        strategy: 'none',
        targetPointCount: 4,
      })
      return result.kind === 'source-indexes' ? [...result.sourceIndexes] : []
    },
    verifyWorkerWasm: async () => {
      const host = document.createElement('div')
      document.body.append(host)
      const chart = init(
        host,
        { width: 400, height: 220, animationEnabled: false },
        { autoResize: false },
      )
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        return await new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Packed WASM Worker did not complete.')), 15000)
          chart.on('sampling-error', (error) => reject(new Error(error.message)))
          chart.on('sampling-complete', (diagnostic) => {
            if (diagnostic.backend === 'wasm')
              resolve({ backend: diagnostic.backend, points: diagnostic.renderedPointCount })
          })
          chart.setOption({
            data: {
              kind: 'typed-samples',
              values: Float32Array.from({ length: 2000 }, (_, i) => Math.sin(i)),
              sampleRate: 100,
            },
            rendering: {
              sampling: { mode: 'wasm', strategy: 'peak', autoThreshold: 2, maxPointCount: 32 },
            },
          })
        })
      } finally {
        clearTimeout(timer)
        chart.dispose()
        host.remove()
      }
    },
    events,
    annotations: () => annotations.value,
    resize: (value: number) => {
      width.value = value
    },
    dispose: () => app.unmount(),
  },
})

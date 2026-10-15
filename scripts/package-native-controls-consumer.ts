import { createApp, defineComponent, h, ref } from 'vue'
import { WaveformChart } from 'waveform-analysis/vue'
import {
  init,
  getInstanceByDom,
  dispose,
  type WaveformAnnotation,
  type WaveformData,
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
    events,
    annotations: () => annotations.value,
    resize: (value: number) => {
      width.value = value
    },
    dispose: () => app.unmount(),
  },
})

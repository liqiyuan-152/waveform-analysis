import { createApp, defineComponent, h, ref } from 'vue'
import { WaveformChart, type WaveformAnnotation, type WaveformData } from 'waveform-analysis'
import 'waveform-analysis/style.css'

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
    events,
    annotations: () => annotations.value,
    resize: (value: number) => {
      width.value = value
    },
    dispose: () => app.unmount(),
  },
})

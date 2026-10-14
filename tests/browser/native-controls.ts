import { createApp, defineComponent, h, ref } from 'vue'
import WaveformChart from '@/components/WaveformChart.vue'
import WaveformAnnotationEditor from '@/components/annotation/WaveformAnnotationEditor.vue'
import type { WaveformAnnotation } from '@/types'
import '@/components/WaveformChart.css'

if (new URLSearchParams(location.search).has('antd')) {
  await import('ant-design-vue/dist/antd.css')
}

const editor = ref(false)
const secondEditor = ref(false)
const mode = ref<'add' | 'edit'>('edit')
const width = ref(800)
const error = ref('')
const annotation = ref<WaveformAnnotation>({
  id: 'note',
  seriesId: 's0',
  x: 1,
  y: 2,
  text: '已有标注',
})
const events: unknown[] = []
const app = createApp(
  defineComponent({
    setup() {
      return () =>
        h('div', [
          h(
            'button',
            {
              id: 'open-editor',
              onClick: () => {
                editor.value = true
              },
            },
            '打开标注',
          ),
          h(WaveformChart, {
            width: width.value,
            height: 400,
            animationEnabled: false,
            displayMode: 'independent',
            grid: { rowCount: 1, columnCount: 1 },
            data: {
              kind: 'series',
              series: Array.from({ length: 12 }, (_, i) => ({
                id: `s${i}`,
                name: `Channel ${i}`,
                data: { kind: 'samples' as const, values: [0, 2, 1], sampleRate: 1 },
              })),
            },
            onPageChange: (value: number) => events.push(['page', value]),
          }),
          editor.value
            ? h(WaveformAnnotationEditor, {
                annotation: annotation.value,
                mode: mode.value,
                series: { id: 's0', name: 'Channel 0', color: '#1677ff', unit: 'V' },
                timeError: error.value,
                onConfirm: (value: WaveformAnnotation) => {
                  events.push(['confirm', value])
                  editor.value = false
                },
                onCancel: () => {
                  events.push(['cancel'])
                  editor.value = false
                },
                onTimeChange: (value: string) => events.push(['time', value]),
              })
            : null,
          secondEditor.value
            ? h(WaveformAnnotationEditor, {
                annotation: { ...annotation.value, id: 'second-editor' },
                mode: 'edit',
                onCancel: () => {
                  secondEditor.value = false
                },
              })
            : null,
        ])
    },
  }),
)
app.mount('#controls')
Object.assign(window, {
  nativeControls: {
    events,
    openSecond: () => {
      secondEditor.value = true
    },
    closeFirst: () => {
      editor.value = false
    },
    configure: (options: { width?: number; mode?: 'add' | 'edit'; error?: string }) => {
      if (options.width) width.value = options.width
      if (options.mode) mode.value = options.mode
      error.value = options.error ?? ''
      annotation.value = {
        ...annotation.value,
        id: `${Date.now()}`,
        text: options.mode === 'add' ? '' : '已有标注',
      }
    },
    dispose: () => app.unmount(),
  },
})

import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import App from '@demo/App.vue'
import DisplayApp from '@demo/display/App.vue'
import DemoControlPanel from '@demo/demo/DemoControlPanel.vue'
import { WaveformChart } from 'waveform-analysis/vue'
import { provideTheme } from '@demo/theme/useTheme'

const wrappers: Array<ReturnType<typeof mount>> = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  localStorage.clear()
})

it('updates analysis defaults in place while retaining custom colors and chart state', async () => {
  localStorage.setItem('waveform-demo-theme', 'light')
  let theme!: ReturnType<typeof provideTheme>
  const wrapper = mount(
    defineComponent({
      setup() {
        theme = provideTheme()
        return () => h(App)
      },
    }),
    {
      global: {
        stubs: {
          WaveformChart: defineComponent({
            name: 'WaveformChart',
            props: ['data', 'grid', 'annotations', 'hiddenSeriesIds', 'frameStyle', 'title'],
            setup(_, { expose }) {
              expose({ resetViewport: vi.fn() })
              return () => h('div')
            },
          }),
        },
      },
    },
  )
  wrappers.push(wrapper)
  const chart = wrapper.getComponent(WaveformChart)
  const original = chart.vm
  const model = wrapper.getComponent(DemoControlPanel).props('model')
  model.frameBorderColor = '#123456'
  model.horizontalGridColor = '#dfe5ef' // Explicit choice equal to the light default.
  const annotations = [{ id: 'note', seriesId: 'sine', x: 0, y: 1, text: '保留' }]
  chart.vm.$emit('update:annotations', annotations)
  chart.vm.$emit('update:hiddenSeriesIds', ['sine'])
  model.rowCount = 2
  await nextTick()
  const data = chart.props('data')
  theme.preference.value = 'dark'
  await nextTick()
  expect(chart.vm).toBe(original)
  expect(chart.props('data')).toBe(data)
  expect(chart.props('grid')?.rowCount).toBe(2)
  expect(chart.props('annotations')).toEqual(annotations)
  expect(chart.props('hiddenSeriesIds')).toEqual(['sine'])
  expect(chart.props('frameStyle')?.borderColor).toBe('#123456')
  expect(model.horizontalGridColor).toBe('#dfe5ef')
  expect(model.verticalGridColor).toBe('#334155')
  expect(chart.props('title')?.textStyle?.color).toBe('#f1f5f9')
  theme.preference.value = 'light'
  await nextTick()
  expect(model.frameBorderColor).toBe('#123456')
  expect(model.verticalGridColor).toBe('#dfe5ef')
})

it('keeps manually selected display background while updating untouched theme colors', async () => {
  localStorage.setItem('waveform-demo-theme', 'light')
  let theme!: ReturnType<typeof provideTheme>
  const updateOptions = vi.fn()
  const wrapper = mount(
    defineComponent({
      setup() {
        theme = provideTheme()
        return () => h(DisplayApp)
      },
    }),
    { global: { stubs: { WaveformPreview: true, ConfigPanel: true, AnimationPanel: true } } },
  )
  wrappers.push(wrapper)
  const preview = wrapper.findComponent({ name: 'WaveformPreview' })
  preview.vm.$emit('ready', { updateOptions, getOptions: () => ({}) })
  await nextTick()
  wrapper
    .findComponent({ name: 'ConfigPanel' })
    .vm.$emit('field', 'frame.backgroundColor', '#ffffff')
  await nextTick()
  updateOptions.mockClear()
  theme.preference.value = 'dark'
  await nextTick()
  expect(updateOptions).toHaveBeenCalledWith({ frame: { borderColor: '#94a3b8' } })
  expect(
    updateOptions.mock.calls.some(([patch]) => patch.frame?.backgroundColor !== undefined),
  ).toBe(false)
  expect(wrapper.findComponent({ name: 'WaveformPreview' }).vm).toBe(preview.vm)
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive, toRaw } from 'vue'
import WaveformChart from '@/adapters/vue/WaveformChart.vue'
import { VueChartAdapter } from '@/adapters/vue/VueChartAdapter'
import * as snapshots from '@/adapters/vue/vueOptionSnapshot'
import { flushNativeUpdates } from '../../support/nativeChart'

afterEach(() => vi.restoreAllMocks())
const data = { kind: 'samples' as const, sampleRate: 10, values: [0, 1, 0] }

describe('Vue snapshot boundary', () => {
  it('captures component updates once while tracking nested annotation/style/formatter changes', async () => {
    const annotations = reactive([
      { id: 'a', seriesId: 'series-0', x: 0.1, y: 1, text: 'old', style: { textColor: '#123456' } },
    ])
    const axes = reactive({ x: { labelFormatter: (x: number) => String(x) } })
    const wrapper = mount(WaveformChart, {
      props: { data, annotations, axes, width: 800, height: 400, animationEnabled: false },
    })
    try {
      await flushNativeUpdates()
      const capture = vi.spyOn(snapshots, 'snapshotVueOptions')
      annotations[0]!.text = 'new'
      annotations[0]!.style.textColor = '#654321'
      axes.x.labelFormatter = (x) => `tick:${x}`
      await nextTick()
      await flushNativeUpdates()
      expect(capture).toHaveBeenCalledOnce()
      expect(capture.mock.results[0]!.value.data).toBe(wrapper.props('data'))
      expect(toRaw(capture.mock.results[0]!.value.data)).toBe(data)
      expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toMatch(/^tick:/)
      expect(wrapper.text()).toContain('new')
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps direct adapter calls defensive and snapshot/equality safe for cycles and undefined', async () => {
    const host = document.createElement('div')
    const adapter = new VueChartAdapter(() => {})
    const title = { text: 'first', textStyle: { color: 'red' } }
    const capture = vi.spyOn(snapshots, 'snapshotVueOptions')
    try {
      adapter.attach(host, { data, title, width: 800, height: 400, animationEnabled: false })
      expect(capture).toHaveBeenCalledOnce()
      const before = capture.mock.results[0]!.value
      title.textStyle.color = 'blue'
      expect(before.title.textStyle.color).toBe('red')
      adapter.update({ data, title, width: 800, height: 400, animationEnabled: false })
      expect(capture).toHaveBeenCalledTimes(2)
      await flushNativeUpdates()
      const cyclic: { backgroundColor?: string; self?: unknown } = { backgroundColor: undefined }
      cyclic.self = cyclic
      const first = snapshots.snapshotVueOptions({ data, legend: cyclic })
      const second = snapshots.snapshotVueOptions({ data, legend: cyclic })
      expect(first.data).toBe(data)
      expect((first.legend as typeof cyclic).self).toBe(first.legend)
      expect(snapshots.equalVueOption(first, second)).toBe(true)
      expect(Object.hasOwn(first.legend!, 'backgroundColor')).toBe(true)
    } finally {
      adapter.dispose()
    }
  })
})

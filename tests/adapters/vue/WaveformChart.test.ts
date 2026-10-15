import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive, shallowRef } from 'vue'
import WaveformChart from '@/adapters/vue/WaveformChart.vue'
import { WaveformChart as NativeChart } from '@/chart/WaveformChart'
import { getInstanceByDom } from '@/chart/init'
import * as preparedSeries from '@/core/preparedWaveformSeries'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformChartHandle } from '@/types/controls'
import { flushNativeUpdates } from '../../support/nativeChart'
import { nativeEventSamples } from '../../support/nativeEventSamples'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'
import type { WaveformChartEvents } from '@/types/native'
import { resizeObservers } from '../../support/setup'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
const data = {
  kind: 'points' as const,
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
}
async function chart(props = {}) {
  const wrapper = mount(WaveformChart, {
    props: { data, width: 800, height: 400, animationEnabled: false, ...props },
  })
  wrappers.push(wrapper)
  await flushNativeUpdates()
  return wrapper
}

describe('Vue compatibility component', () => {
  it('preserves legacy adaptive size and invalid remote-boundary fallbacks', async () => {
    const wrapper = await chart({ width: Infinity, height: NaN, panXDomain: [0, NaN] })
    expect(wrapper.attributes('style')).toContain('width: 100%')
    expect(wrapper.attributes('style')).toContain('height: 100%')
    resizeObservers.at(-1)?.resize(800, 400)
    await flushNativeUpdates()
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('800')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('400')
    await wrapper.setProps({ panXDomain: [1, 0] })
    await flushNativeUpdates()
    expect(wrapper.vm.getControlState().targets[0]?.viewport.xDomain).toEqual([0, 1])
  })
  it('forwards every declared event with the original tuple and object identities', async () => {
    const subscriptions = vi.spyOn(ChartEventEmitter.prototype, 'on')
    const wrapper = await chart()
    const backend = subscriptions.mock.contexts.at(-1)! as ChartEventEmitter
    const samples = nativeEventSamples(wrapper.vm.getControlState())
    const forward = <K extends keyof WaveformChartEvents>(event: K) => {
      const args = samples[event]
      backend.emit(event, ...args)
      const received = wrapper.emitted(event)!.at(-1)!
      expect(received).toEqual(args)
      args.forEach((value, index) => expect(received[index]).toBe(value))
    }
    ;(Object.keys(samples) as Array<keyof WaveformChartEvents>).forEach(forward)
  })
  it('initializes one native chart and exposes the existing handle', async () => {
    const wrapper = await chart()
    expect(getInstanceByDom(wrapper.element)).toBeDefined()
    expect(wrapper.findAll('.waveform-native-chart')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(1)
    const api: WaveformChartHandle = wrapper.vm
    expect(api.getControlState().mode).toBe('zoom')
    expect(api.setViewportDomain([0.2, 0.8], 0)).toBeUndefined()
    expect(api.resetViewport({}).status).toBe('applied')
    expect(wrapper.emitted('rendered')?.length).toBeGreaterThan(0)
    expect(wrapper.emitted('finished')).toHaveLength(1)
  })

  it('keeps immutable data references during unrelated prop updates and refreshes on replacement', async () => {
    const wrapper = await chart()
    const prepare = vi.spyOn(preparedSeries, 'prepareWaveformSeries')
    const setOption = vi.spyOn(NativeChart.prototype, 'setOption')
    await wrapper.setProps({ lineColor: 'red' })
    await flushNativeUpdates()
    expect(setOption).toHaveBeenCalledExactlyOnceWith({ lineColor: 'red' })
    expect(prepare).not.toHaveBeenCalled()
    expect(wrapper.get('.waveform-chart__line').attributes('stroke')).toBe('red')
    data.points.push({ x: 2, y: 2 })
    await nextTick()
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1000')
    await wrapper.setProps({ data: { ...data, points: [...data.points] } })
    await flushNativeUpdates()
    expect(prepare).toHaveBeenCalledOnce()
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2000')
    data.points.pop()
  })

  it('releases controlled props and optional bounds when the parent removes them', async () => {
    const options = shallowRef<WaveformChartOptions>({
      interactionMode: 'pan' as const,
      hiddenSeriesIds: ['series-0'],
      initialXDomain: [0.2, 0.8] as [number, number],
    })
    const chartRef = shallowRef<WaveformChartHandle>()
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(WaveformChart, {
            data,
            width: 800,
            height: 400,
            animationEnabled: false,
            pannable: true,
            ref: chartRef,
            ...options.value,
          }),
      }),
    )
    wrappers.push(wrapper)
    await flushNativeUpdates()
    const api = chartRef.value!
    expect(api.getControlState().mode).toBe('pan')
    expect(wrapper.find('.waveform-chart__line').exists()).toBe(false)
    options.value = {}
    await nextTick()
    await flushNativeUpdates()
    expect(api.getControlState().mode).toBe('zoom')
    expect(wrapper.find('.waveform-chart__line').exists()).toBe(true)
    expect(api.getControlState().targets[0]?.viewport.xDomain).toEqual([0, 1])
  })

  it('reads updated Vue listeners without replacing native subscriptions', async () => {
    const first = vi.fn(),
      second = vi.fn()
    const wrapper = await chart({ 'onZoom-end': first })
    wrapper.vm.zoomIn()
    expect(first).toHaveBeenCalledOnce()
    await wrapper.setProps({ 'onZoom-end': second })
    wrapper.vm.zoomOut()
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('observes nested configuration changes while keeping data opaque', async () => {
    const title = reactive({ text: '原题', textStyle: { color: '#123456' } })
    const wrapper = await chart({ title })
    const normalize = vi.spyOn(preparedSeries, 'prepareWaveformSeries')
    title.text = '更新标题'
    title.textStyle.color = '#654321'
    await nextTick()
    await flushNativeUpdates()
    expect(wrapper.get('.waveform-chart__title-text').text()).toBe('更新标题')
    expect(wrapper.get('.waveform-chart__title-text').attributes('style')).toContain(
      'rgb(101, 67, 33)',
    )
    expect(normalize).not.toHaveBeenCalled()
  })

  it('forwards controlled requests without applying an unacknowledged mode', async () => {
    const wrapper = await chart({ toolbar: true, pannable: true, interactionMode: 'zoom' })
    await wrapper.get('[data-command="pan"]').trigger('click')
    expect(wrapper.emitted('update:interactionMode')).toEqual([['pan']])
    expect(wrapper.vm.getControlState().mode).toBe('zoom')
    await wrapper.setProps({ interactionMode: 'pan' })
    await flushNativeUpdates()
    expect(wrapper.vm.getControlState().mode).toBe('pan')
    expect(wrapper.get('[data-command="pan"]').attributes('aria-pressed')).toBe('true')
  })

  it('cancels native resources on unmount and permits a new instance on the surviving DOM', async () => {
    const wrapper = await chart()
    const host = wrapper.element
    const instance = getInstanceByDom(host)!
    const api: WaveformChartHandle = wrapper.vm
    wrapper.unmount()
    expect(getInstanceByDom(host)).toBeUndefined()
    expect(instance.isDisposed()).toBe(true)
    await expect(api.exportImage()).rejects.toMatchObject({ code: 'export-cancelled' })
  })
})

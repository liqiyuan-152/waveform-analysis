import { resizeChart } from '@tests/support/setup'
import { mount } from '@vue/test-utils'
import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'
import App from '@/App.vue'
import { WaveformChart } from '@/components'
import { remoteWindowLoaderKey, type RemoteWindowRequest } from '@/demo/remoteWaveformLoader'
import type { WaveformData } from '@/types'
import { flushAnimationFrames } from '@tests/support/setup'
import { applyXDomainStrategy } from '@/components/core/xDomain'

describe('remote demo integration', () => {
  it('commits wheel gestures while request state updates rerender the demo', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    resizeChart(1000, 800)
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)
    const strategy = chart.props('xDomainStrategy')
    const overlay = chart.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width'))
    const height = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    const before = chart.vm.getControlState().targets[0].viewport.xDomain
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -200,
        clientX: width / 2,
        clientY: height / 2,
        bubbles: true,
        cancelable: true,
      }),
    )
    // Vue must render the changed request state before the pending animation frame.
    await flushPromises()
    expect(chart.props('xDomainStrategy')).toBe(strategy)
    flushAnimationFrames()
    await flushPromises()
    const after = chart.vm.getControlState().targets[0].viewport.xDomain
    expect(after[1] - after[0]).toBeLessThan(before[1] - before[0])
    wrapper.unmount()
  })

  it('connects range events, loading, error and retry without changing controlled state', async () => {
    const calls: {
      request: RemoteWindowRequest
      signal: AbortSignal
      resolve: (data: WaveformData) => void
      reject: (error: Error) => void
    }[] = []
    const wrapper = mount(App, {
      attachTo: document.body,
      global: {
        provide: {
          [remoteWindowLoaderKey as symbol]: (request: RemoteWindowRequest, signal: AbortSignal) =>
            new Promise<WaveformData>((resolve, reject) =>
              calls.push({ request, signal, resolve, reject }),
            ),
        },
      },
    })
    await flushPromises()
    const chart = wrapper.getComponent(WaveformChart)
    const domain = chart.props('initialXDomain')!
    expect(chart.props('panXDomain')).toEqual(
      applyXDomainStrategy(domain, chart.props('xDomainStrategy')!, true),
    )
    expect(chart.props('minVisiblePoints')).toBe(2)
    expect(chart.props('maxZoomScale')).toBe(null)
    expect(chart.props('minZoomSpan')).toBeGreaterThan(0)
    expect(wrapper.get('.remote-window-status [role="status"]').text()).toContain('正在加载')
    const initial = chart.props('data')
    calls[0].resolve(initial)
    await flushPromises()
    expect(wrapper.find('.remote-window-status [role="status"]').exists()).toBe(false)
    const annotations = [{ id: 'note', seriesId: 'simulated-sine', x: 0, y: 1, text: 'keep' }]
    chart.vm.$emit('update:annotations', annotations)
    chart.vm.$emit('update:hidden-series-ids', ['simulated-harmonic'])
    chart.vm.$emit('zoom-end', { start: 0, end: 1 })
    chart.vm.$emit('zoom-intent', { start: 1, end: 2, gesture: 'wheel' })
    expect(calls[1].signal.aborted).toBe(true)
    calls[1].resolve(initial)
    chart.vm.$emit('pan-end', { start: 1, end: 2 })
    calls[2].reject(new Error('连接失败'))
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('连接失败')
    await wrapper.get('.remote-window-status button').trigger('click')
    expect(calls[3].request).toEqual({ start: 1, end: 2 })
    calls[3].resolve(initial)
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(chart.props('initialXDomain')).toEqual(domain)
    expect(chart.props('annotations')).toEqual(annotations)
    expect(chart.props('hiddenSeriesIds')).toEqual(['simulated-harmonic'])
    chart.vm.$emit('zoom-reset', {})
    expect(calls[4].request).toEqual({ start: domain[0], end: domain[1] })
    wrapper.unmount()
    expect(calls[4].signal.aborted).toBe(true)
    calls[4].resolve(initial)
    await flushPromises()
  })
})

// @vitest-environment jsdom
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useWaveform } from '../../../demo-app/src/display/composables/useWaveform'
import { Waveform } from 'waveform-analysis/display'
import WaveformPreview from '../../../demo-app/src/display/components/WaveformPreview.vue'
import { initialOptions } from '../../../demo-app/src/display/config/initial'

describe('Vue preview ownership', () => {
  it('fits the preview container on resize and releases its observer on unmount', () => {
    let notifyResize = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize = callback
        }
        observe() {}
        disconnect = disconnect
      },
    )
    try {
      const wrapper = mount(WaveformPreview, { props: { data: [], options: initialOptions } })
      const host = wrapper.element as HTMLElement
      let height = 700
      Object.defineProperties(host, {
        clientWidth: { get: () => 960 },
        clientHeight: { get: () => height },
      })
      notifyResize()
      expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 960 700')
      height = 480
      notifyResize()
      expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 960 480')
      wrapper.unmount()
      expect(disconnect).toHaveBeenCalledOnce()
      notifyResize()
      expect(host.querySelector('svg')).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps two preview instances isolated while one unmounts', async () => {
    const first = mount(WaveformPreview, { props: { data: [{ x: 0, y: 1 }], options: {} } })
    const secondData = ref([{ x: 0, y: 2 }])
    const second = mount(
      defineComponent({
        setup: () => () => h(WaveformPreview, { data: secondData.value, options: {} }),
      }),
    )
    await nextTick()
    const owner = Waveform.getInstanceByDom(second.element as HTMLElement)!
    const before = owner.toSVGString()
    first.unmount()
    expect(owner.toSVGString()).toBe(before)
    secondData.value = [
      { x: 0, y: 4 },
      { x: 1, y: 6 },
    ]
    await nextTick()
    expect(owner.toSVGString()).not.toBe(before)
    second.unmount()
    expect(owner.toSVGString()).toBe('')
  })
  it('creates only after mounting, releases its instance, and remounts without duplicate resources', async () => {
    let current: Waveform | null = null
    const errors = vi.fn()
    const Component = defineComponent({
      setup() {
        const target = ref<HTMLElement | null>(null)
        const chart = useWaveform(target, () => ({ data: [], options: {} }), errors)
        return () => {
          current = chart.value
          return h('div', { ref: target })
        }
      },
    })
    const wrapper = mount(Component)
    await nextTick()
    const host = wrapper.element as HTMLElement
    const first = Waveform.getInstanceByDom(host)!
    expect(first).toBe(current)
    expect(host.querySelectorAll('svg')).toHaveLength(1)
    wrapper.unmount()
    expect(Waveform.getInstanceByDom(host)).toBeUndefined()
    expect(first.toSVGString()).toBe('')
    const second = mount(Component)
    await nextTick()
    expect(second.element.querySelectorAll('svg')).toHaveLength(1)
    second.unmount()
    expect(errors).not.toHaveBeenCalled()
  })

  it('rejects an occupied element without destroying its owner', async () => {
    let owner: Waveform | undefined
    const errors = vi.fn()
    const Component = defineComponent({
      setup() {
        const target = ref<HTMLElement | null>(null)
        useWaveform(target, () => ({ data: [], options: {} }), errors)
        return () =>
          h('div', {
            ref: (value: unknown) => {
              if (value) {
                target.value = value as HTMLElement
                owner ??= new Waveform(target.value, [])
              }
            },
          })
      },
    })
    const wrapper = mount(Component)
    await nextTick()
    expect(errors).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(owner!.getOptions()).toBeDefined()
    owner!.destroy()
  })

  it('reports a missing template ref without creating a chart', () => {
    const errors = vi.fn()
    const Component = defineComponent({
      setup() {
        useWaveform(ref(null), () => ({ data: [], options: {} }), errors)
        return () => h('span')
      },
    })
    const wrapper = mount(Component)
    expect(errors).toHaveBeenCalledTimes(1)
    expect(wrapper.element.querySelector('svg')).toBeNull()
    wrapper.unmount()
  })
})

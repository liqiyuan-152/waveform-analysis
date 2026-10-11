import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { flushAnimationFrames } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

const points = Array.from({ length: 1001 }, (_, index) => ({
  x: (index + 0.5) / 10000,
  y: index % 7,
}))
const data = {
  kind: 'series' as const,
  series: ['Doppler_01', 'Doppler_02'].map((id) => ({
    id,
    name: id,
    data: { kind: 'points' as const, points },
  })),
}

describe('customer Doppler zoom regression', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'zooms below 1ms to two samples and wheels out after box zoom (%s)',
    async (displayMode) => {
      const wrapper = await mountSizedChart(data, {
        displayMode,
        initialXDomain: [0, 0.1],
        panXDomain: [0, 0.1],
        minVisiblePoints: 2,
      })
      const overlay = wrapper.get('.waveform-chart__overlay')
      const width = Number(overlay.attributes('width'))
      const height = Number(overlay.attributes('height'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width, height }),
      })
      for (let index = 0; index < 3; index += 1) {
        for (const [type, clientX] of [
          ['pointerdown', width / 2 - 4],
          ['pointerup', width / 2 + 4],
        ] as const) {
          const event = new MouseEvent(type, {
            button: 0,
            clientX,
            clientY: height / 2,
            bubbles: true,
          })
          Object.defineProperty(event, 'pointerId', { value: index + 1 })
          overlay.element.dispatchEvent(event)
        }
        await flushPromises()
      }
      const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
      expect(domain[1] - domain[0]).toBeLessThan(0.001)
      expect(points.filter((point) => point.x >= domain[0] && point.x <= domain[1])).toHaveLength(2)
      // A remote response can rebase the chart onto the loaded window.
      await wrapper.setProps({
        initialXDomain: domain,
        data: {
          ...data,
          series: data.series.map((series) => ({
            ...series,
            data: {
              kind: 'points' as const,
              points: points.filter((p) => p.x >= domain[0] && p.x <= domain[1]),
            },
          })),
        },
      })
      await flushPromises()
      wrapper.vm.setViewportDomain(domain)
      await flushPromises()
      const count = wrapper.emitted('zoom-change')?.length ?? 0
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: 300,
          clientX: width / 2,
          clientY: height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
      expect(wrapper.emitted('zoom-change')?.length).toBeGreaterThan(count)
      const expanded = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
      expect(expanded[1] - expanded[0]).toBeGreaterThan(domain[1] - domain[0])
      wrapper.unmount()
    },
  )
})

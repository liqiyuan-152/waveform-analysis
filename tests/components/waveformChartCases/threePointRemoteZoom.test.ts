import { describe, expect, it } from 'vitest'
import { flushAnimationFrames } from '@tests/support/setup'
import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'

const points = [
  { x: 2.046755, y: 0.34927901121538163 },
  { x: 2.046756, y: 0.32944228274967635 },
  { x: 2.046757, y: 0.3465323872739763 },
]

describe('three-sample remote zoom', () => {
  const cases = (['independent', 'separated', 'compact'] as const).flatMap((displayMode) =>
    (['wheel', 'box'] as const).map((gesture) => ({ displayMode, gesture })),
  )
  it.each(cases)(
    'retains exactly two real samples and stops, then zooms out ($displayMode/$gesture)',
    async ({ displayMode, gesture }) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: ['first', 'second'].map((id) => ({
            id,
            name: id,
            data: { kind: 'points', points },
          })),
        },
        {
          displayMode,
          integerZoom: false,
          timeUnit: 'ms',
          minVisiblePoints: 2,
          maxZoomScale: null,
          initialXDomain: [0, 4],
          panXDomain: [0, 4],
        },
      )
      wrapper.vm.setViewportDomain([2.046755, 2.0467573])
      await flushVueChartUpdates()
      const overlay = wrapper.get('.waveform-chart__overlay')
      const width = Number(overlay.attributes('width'))
      const height = Number(overlay.attributes('height'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width, height }),
      })
      const wheel = async (deltaY: number) => {
        overlay.element.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY,
            clientX: width / 2,
            clientY: height / 2,
            bubbles: true,
            cancelable: true,
          }),
        )
        flushAnimationFrames()
        await flushVueChartUpdates()
      }
      if (gesture === 'wheel') {
        await wheel(-1000)
      } else {
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
          Object.defineProperty(event, 'pointerId', { value: 81 })
          overlay.element.dispatchEvent(event)
        }
        await flushVueChartUpdates()
      }
      for (let step = 0; step < 40; step += 1) await wheel(-1000)
      const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
      expect(points.filter((p) => p.x >= domain[0] && p.x <= domain[1])).toHaveLength(2)
      expect(domain[1] - domain[0]).toBeLessThan(2.3e-6)
      const count = wrapper.emitted('zoom-change')?.length
      await wheel(-1000)
      expect(wrapper.emitted('zoom-change')?.length).toBe(count)
      // Immutable remote replacement must preserve the exact two-point viewport.
      await wrapper.setProps({
        data: {
          kind: 'series',
          series: ['first', 'second'].map((id) => ({
            id,
            name: id,
            data: {
              kind: 'points',
              points: points.filter((p) => p.x >= domain[0] && p.x <= domain[1]),
            },
          })),
        },
      })
      await wheel(-1000)
      expect(wrapper.emitted('zoom-change')?.length).toBe(count)
      await wheel(1000)
      const expanded = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
      expect(expanded[1] - expanded[0]).toBeGreaterThan(domain[1] - domain[0])
      wrapper.unmount()
    },
  )
})

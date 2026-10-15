import { resizeChart } from '@tests/support/setup'
import { describe, expect, it } from 'vitest'
import { flushAnimationFrames } from '@tests/support/setup'
import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'

const modes = ['independent', 'separated', 'compact'] as const
const points = Array.from({ length: 101 }, (_, x) => ({ x, y: x }))

describe('wheel steps share toolbar zoom constraints', () => {
  it.each(
    modes.flatMap((displayMode) =>
      [320, 800].map((containerWidth) => ({ displayMode, containerWidth })),
    ),
  )(
    'anchors at the pointer and reverses the step in $displayMode at $containerWidth px',
    async ({ displayMode, containerWidth }) => {
      const w = await mountSizedChart(
        { kind: 'points', points },
        {
          displayMode,
          initialXDomain: [0, 100],
          minVisiblePoints: 2,
          maxZoomScale: null,
        },
      )
      try {
        resizeChart(containerWidth, 360)
        await flushVueChartUpdates()
        for (const ratio of [0.2, 0.5, 0.8]) {
          for (const deltaY of [-1, -100, -4000]) {
            w.vm.setViewportDomain([0, 100])
            await flushVueChartUpdates()
            const overlay = w.get('.waveform-chart__overlay')
            const width = Number(overlay.attributes('width'))
            Object.defineProperty(overlay.element, 'getBoundingClientRect', {
              configurable: true,
              value: () => ({ left: 30, top: 0, width, height: 200 }),
            })
            const wheel = async (deltaY: number) => {
              overlay.element.dispatchEvent(
                new WheelEvent('wheel', {
                  deltaY,
                  clientX: 30 + width * ratio,
                  clientY: 100,
                  bubbles: true,
                  cancelable: true,
                }),
              )
              flushAnimationFrames()
              await flushVueChartUpdates()
            }
            await wheel(deltaY)
            const domain = w.vm.getControlState().targets[0]!.viewport.xDomain
            expect(domain[0]).toBeCloseTo(50 * ratio)
            expect(domain[1]).toBeCloseTo(50 * ratio + 50)
            expect(domain[0] + (domain[1] - domain[0]) * ratio).toBeCloseTo(100 * ratio)
            await wheel(1)
            const restored = w.vm.getControlState().targets[0]!.viewport.xDomain
            expect(restored[0]).toBeCloseTo(0)
            expect(restored[1]).toBeCloseTo(100)
          }
        }
      } finally {
        w.unmount()
      }
    },
  )

  it.each(modes)(
    'matches toolbar steps at the center, including integer limits (%s)',
    async (displayMode) => {
      const w = await mountSizedChart(
        { kind: 'points', points: [0.001, 0.002, 0.003].map((x) => ({ x, y: x })) },
        {
          displayMode,
          integerZoom: true,
          initialXDomain: [0, 0.004],
          minVisiblePoints: 2,
          maxZoomScale: null,
          panXDomain: [0, 0.004],
        },
      )
      try {
        const overlay = w.get('.waveform-chart__overlay')
        const width = Number(overlay.attributes('width'))
        Object.defineProperty(overlay.element, 'getBoundingClientRect', {
          value: () => ({ left: 0, top: 0, width, height: 200 }),
        })
        w.vm.zoomIn()
        await flushVueChartUpdates()
        const expected = w.vm.getControlState().targets[0]!.viewport.xDomain
        w.vm.setViewportDomain([0, 0.004])
        await flushVueChartUpdates()
        overlay.element.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -1,
            clientX: width / 2,
            clientY: 100,
            bubbles: true,
            cancelable: true,
          }),
        )
        flushAnimationFrames()
        await flushVueChartUpdates()
        const actual = w.vm.getControlState().targets[0]!.viewport.xDomain
        expect(actual[0]).toBeCloseTo(expected[0], 12)
        expect(actual[1]).toBeCloseTo(expected[1], 12)
        expect(actual[1] - actual[0]).toBeLessThan(0.004)
      } finally {
        w.unmount()
      }
    },
  )

  it('stops both controls at the minimum two-sample range and ignores zero wheel deltas', async () => {
    const w = await mountSizedChart(
      { kind: 'points', points: [0, 1, 2].map((x) => ({ x, y: x })) },
      { initialXDomain: [0, 4], minVisiblePoints: 2, maxZoomScale: null },
    )
    try {
      const overlay = w.get('.waveform-chart__overlay')
      const width = Number(overlay.attributes('width'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width, height: 200 }),
      })
      const wheel = (deltaY: number) =>
        overlay.element.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY,
            clientX: width / 4,
            clientY: 100,
            bubbles: true,
            cancelable: true,
          }),
        )
      for (let step = 0; step < 64; step += 1) wheel(-1)
      flushAnimationFrames()
      await flushVueChartUpdates()
      const domain = w.vm.getControlState().targets[0]!.viewport.xDomain
      expect(points.filter((p) => p.x >= domain[0] && p.x <= domain[1])).toHaveLength(2)
      const count = w.emitted('zoom-change')?.length
      expect(w.vm.zoomIn().status).toBe('unchanged')
      wheel(-1)
      wheel(0)
      flushAnimationFrames()
      await flushVueChartUpdates()
      expect(w.emitted('zoom-change')?.length).toBe(count)
      wheel(1)
      flushAnimationFrames()
      await flushVueChartUpdates()
      const expanded = w.vm.getControlState().targets[0]!.viewport.xDomain
      expect(expanded[1] - expanded[0]).toBeGreaterThan(domain[1] - domain[0])
    } finally {
      w.unmount()
    }
  })

  it('accumulates successive wheel events before the next animation frame', async () => {
    const w = await mountSizedChart(
      { kind: 'points', points },
      { initialXDomain: [0, 100], minVisiblePoints: 2, maxZoomScale: null },
    )
    try {
      const overlay = w.get('.waveform-chart__overlay')
      const width = Number(overlay.attributes('width'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width, height: 200 }),
      })
      for (let step = 0; step < 2; step += 1) {
        overlay.element.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -1,
            clientX: width / 4,
            clientY: 100,
            bubbles: true,
            cancelable: true,
          }),
        )
      }
      expect(w.emitted('zoom-intent')).toHaveLength(2)
      expect(w.emitted('zoom-change')).toBeUndefined()
      flushAnimationFrames()
      await flushVueChartUpdates()
      expect(w.emitted('zoom-change')).toHaveLength(1)
      const domain = w.vm.getControlState().targets[0]!.viewport.xDomain
      expect(domain[0]).toBeCloseTo(18.75)
      expect(domain[1]).toBeCloseTo(43.75)
    } finally {
      w.unmount()
    }
  })
})

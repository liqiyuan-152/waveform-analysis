import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'
import { flushAnimationFrames } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

const data = {
  kind: 'series' as const,
  series: Array.from({ length: 4 }, (_, index) => ({
    id: `SX2_7_0${index + 1}`,
    name: `SX2_7_0${index + 1}`,
    data: {
      kind: 'points' as const,
      points: Array.from({ length: 3001 }, (_, sample) => ({
        x: 1.988 + sample / 1_000_000,
        y: Math.sin(sample + index),
      })),
    },
  })),
}

describe('integer zoom rounding does not disable dense viewports', { timeout: 20_000 }, () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'continues toolbar and wheel zoom from 1988–1991 ms in %s mode',
    async (displayMode) => {
      for (const remote of [false, true]) {
        const w = await mountSizedChart(data, {
          displayMode,
          grid: { rowCount: 4, columnCount: 1 },
          initialXDomain: [0, 10],
          panXDomain: remote ? [0, 10] : undefined,
          integerZoom: true,
          timeUnit: 'ms',
          minVisiblePoints: 2,
          toolbar: true,
          rendering: { sampling: { mode: 'raw' } },
        })
        try {
          w.vm.setViewportDomain([1.988, 1.991])
          await flushPromises()
          expect(w.vm.getControlState().available['zoom-in']).toBe(true)
          expect(w.get('[data-command="zoom-in"]').attributes('disabled')).toBeUndefined()
          await w.get('[data-command="zoom-in"]').trigger('click')
          await flushPromises()
          for (const target of w.vm.getControlState().targets) {
            expect(target.viewport.xDomain[0]).toBeCloseTo(1.98875, 12)
            expect(target.viewport.xDomain[1]).toBeCloseTo(1.99025, 12)
          }
          w.vm.setViewportDomain([1.988, 1.991])
          await flushPromises()
          const overlay = w.get('.waveform-chart__overlay')
          const width = Number(overlay.attributes('width'))
          Object.defineProperty(overlay.element, 'getBoundingClientRect', {
            value: () => ({ left: 0, top: 0, width, height: 100 }),
          })
          overlay.element.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY: -1,
              clientX: width / 2,
              clientY: 50,
              bubbles: true,
              cancelable: true,
            }),
          )
          flushAnimationFrames()
          await flushPromises()
          const [start, end] = w.vm.getControlState().targets[0]!.viewport.xDomain
          expect(start).toBeCloseTo(1.98875, 12)
          expect(end).toBeCloseTo(1.99025, 12)
          expect(w.vm.zoomIn().status).toBe('applied')
          await flushPromises()
          const fractional = w.vm.getControlState().targets[0]!.viewport.xDomain
          expect(fractional[1] - fractional[0]).toBeCloseTo(0.00075, 12)
          // SVG sampling must not become the source of minimum-point limits.
          await w.setProps({
            rendering: { sampling: { mode: 'auto', autoThreshold: 2, maxPointCount: 10 } },
          })
          expect(w.vm.zoomIn().status).toBe('applied')
          await flushPromises()
          const sampled = w.vm.getControlState().targets[0]!.viewport.xDomain
          expect(sampled[1] - sampled[0]).toBeCloseTo(0.000375, 12)
        } finally {
          w.unmount()
        }
      }
    },
  )

  it('continues through a two-millisecond window into fractional milliseconds', async () => {
    const w = await mountSizedChart(data, {
      displayMode: 'separated',
      initialXDomain: [0, 10],
      panXDomain: [0, 10],
      integerZoom: true,
      timeUnit: 'ms',
      minVisiblePoints: 2,
    })
    try {
      w.vm.setViewportDomain([1.988, 1.99])
      await flushPromises()
      for (const span of [0.001, 0.0005, 0.00025]) {
        expect(w.vm.zoomIn().status).toBe('applied')
        await flushPromises()
        const [start, end] = w.vm.getControlState().targets[0]!.viewport.xDomain
        expect(end - start).toBeCloseTo(span, 12)
        expect((start + end) / 2).toBeCloseTo(1.989, 12)
      }
    } finally {
      w.unmount()
    }
  })

  it.each([
    { minZoomSpan: 0.003, minVisiblePoints: 2 },
    { maxZoomScale: 1, minVisiblePoints: 2 },
    { minVisiblePoints: 3001 },
  ])('still stops at a genuine limit: %o', async (limit) => {
    for (const remote of [false, true]) {
      const w = await mountSizedChart(data, {
        initialXDomain: [1.988, 1.991],
        panXDomain: remote ? [0, 10] : undefined,
        integerZoom: true,
        timeUnit: 'ms',
        ...limit,
      })
      try {
        expect(w.vm.getControlState().available['zoom-in']).toBe(false)
        expect(w.vm.zoomIn().status).toBe('unchanged')
        const [start, end] = w.vm.getControlState().targets[0]!.viewport.xDomain
        expect(start).toBeCloseTo(1.988, 12)
        expect(end).toBeCloseTo(1.991, 12)
      } finally {
        w.unmount()
      }
    }
  })
})

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  hasMinimumVisibleXValues,
  selectRenderablePoints,
  resolveWaveformRenderingOptions,
} from '@/core/rendering'
import { flushAnimationFrames, resizeObservers } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

const points = [2134.377, 2134.378, 2134.379].map((time, y) => ({ x: time / 1000, y }))
const viewport: [number, number] = [2134.3773 / 1000, 2134.3793 / 1000]
const visibleCount = (domain: [number, number]) =>
  points.filter((p) => p.x >= domain[0] && p.x <= domain[1]).length
const modes = [
  { mode: 'independent', displayMode: 'independent' as const },
  { mode: 'separated', displayMode: 'separated' as const },
  { mode: 'compact', displayMode: 'compact' as const },
  { mode: 'merged', displayMode: 'independent' as const, merged: true },
]
const cases = modes.flatMap((mode) =>
  (['wheel', 'button', 'box'] as const).flatMap((gesture) =>
    [320, 800].map((width) => ({ ...mode, gesture, width })),
  ),
)

describe('zoom with two visible samples and an outside line neighbor', () => {
  it('renders the outside neighbor without counting it as a visible sample', () => {
    expect(visibleCount(viewport)).toBe(2)
    expect(hasMinimumVisibleXValues([{ points }], viewport, 2)).toBe(true)
    expect(hasMinimumVisibleXValues([{ points }], viewport, 3)).toBe(false)
    const selected = selectRenderablePoints(
      points,
      viewport,
      320,
      resolveWaveformRenderingOptions(),
    )
    expect(selected).toEqual(points)
    expect(selected[0]!.x).toBeLessThan(viewport[0])
  })

  it.each(cases)(
    'narrows to the real minimum and zooms out ($mode/$gesture/$width)',
    async ({ displayMode, merged, gesture, width }) => {
      const w = await mountSizedChart(
        {
          kind: 'series',
          series: Array.from({ length: 5 }, (_, index) => ({
            id: `channel-${index}`,
            name: `Channel ${index}`,
            ...(merged ? { trackId: 'merged' } : {}),
            data: { kind: 'points', points },
          })),
        },
        {
          displayMode,
          integerZoom: false,
          minVisiblePoints: 2,
          maxZoomScale: null,
          initialXDomain: [0, 4],
          panXDomain: [0, 4],
        },
      )
      try {
        resizeObservers.at(-1)?.resize(width, 600)
        await flushPromises()
        w.vm.setViewportDomain(viewport)
        await flushPromises()
        const overlay = w.get('.waveform-chart__overlay')
        const plotWidth = Number(overlay.attributes('width'))
        const height = Number(overlay.attributes('height'))
        Object.defineProperty(overlay.element, 'getBoundingClientRect', {
          value: () => ({ left: 0, top: 0, width: plotWidth, height }),
        })
        const domain = () => w.vm.getControlState().targets[0]!.viewport.xDomain
        const wheel = async (deltaY: number) => {
          overlay.element.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY,
              clientX: plotWidth * 0.7,
              clientY: height / 2,
              bubbles: true,
              cancelable: true,
            }),
          )
          flushAnimationFrames()
          await flushPromises()
        }
        const zoom = async () => {
          if (gesture === 'wheel') await wheel(-1)
          else if (gesture === 'button') {
            w.vm.zoomIn()
            await flushPromises()
          } else {
            for (const [type, ratio] of [
              ['pointerdown', 0.2],
              ['pointerup', 0.8],
            ] as const) {
              const event = new MouseEvent(type, {
                button: 0,
                clientX: plotWidth * ratio,
                clientY: height / 2,
                bubbles: true,
              })
              Object.defineProperty(event, 'pointerId', { value: 81 })
              overlay.element.dispatchEvent(event)
            }
            await flushPromises()
          }
        }
        expect(visibleCount(domain())).toBe(2)
        const originalSpan = domain()[1] - domain()[0]
        await zoom()
        expect(domain()[1] - domain()[0]).toBeLessThan(originalSpan - 1e-12)
        expect(visibleCount(domain())).toBe(2)
        for (let step = 0; step < 40; step++) {
          await zoom()
          expect(visibleCount(domain())).toBe(2)
        }
        const limited = [...domain()] as [number, number]
        expect(limited[1] - limited[0]).toBeCloseTo(points[2]!.x - points[1]!.x, 10)
        const count = w.emitted('zoom-change')?.length
        await zoom()
        expect(domain()[0]).toBeCloseTo(limited[0], 11)
        expect(domain()[1]).toBeCloseTo(limited[1], 11)
        expect(w.emitted('zoom-change')?.length).toBe(count)
        await wheel(1)
        expect(domain()[1] - domain()[0]).toBeGreaterThan(limited[1] - limited[0])
        expect(visibleCount(domain())).toBeGreaterThanOrEqual(2)
      } finally {
        w.unmount()
      }
    },
  )
})

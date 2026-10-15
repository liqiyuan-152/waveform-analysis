import { resizeChart } from '@tests/support/setup'
import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'
import {
  constrainZoomDomain,
  resolveMinimumZoomSpan,
} from '@/components/interaction/zoomConstraints'
import { flushAnimationFrames } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

const group = (xs: number[]) => [{ points: xs.map((x) => ({ x, y: x })) }]
const options = { minVisiblePoints: 2, maxZoomScale: null, integerZoom: false }
const boundary: [number, number] = [0, 10]
const sparse = group([0, 10])
const dense = group([4, 4.5, 5, 5.5, 6])
const count = (xs: number[], domain: [number, number]) =>
  xs.filter((x) => x >= domain[0] && x <= domain[1]).length

describe('shared frame zoom headroom', () => {
  it('uses the smallest supporting frame without pooling points between frames', () => {
    expect(resolveMinimumZoomSpan(boundary, [sparse, dense], options)).toBeCloseTo(0.5)
    const domain = constrainZoomDomain([4.9, 5.1], boundary, [sparse, dense], options)
    expect(domain[1] - domain[0]).toBeCloseTo(0.6)
    expect(count([0, 10], domain)).toBe(0)
    expect(count([4, 4.5, 5, 5.5, 6], domain)).toBe(2)
    expect(constrainZoomDomain([4, 6], boundary, [group([4]), group([6])], options)).toEqual(
      boundary,
    )
    const merged = constrainZoomDomain([4, 6], boundary, [[...group([4]), ...group([6])]], options)
    expect(count([4, 6], merged)).toBe(2)
    expect(merged[1] - merged[0]).toBeCloseTo(2)
  })

  it('ignores empty and insufficient frames while preserving single frame fallback', () => {
    const groups = [group([]), group([5, 5]), sparse, dense]
    expect(
      constrainZoomDomain([4.5, 5], boundary, groups, options)[1] -
        constrainZoomDomain([4.5, 5], boundary, groups, options)[0],
    ).toBeCloseTo(0.5)
    expect(constrainZoomDomain([4.5, 5], boundary, [sparse], options)).toEqual(boundary)
    expect(constrainZoomDomain([4.5, 5], boundary, [group([5])], options)).toEqual(boundary)
    expect(constrainZoomDomain([4.5, 5], boundary, [group([])], options)).toEqual([4.5, 5])
  })

  it('honors configurable counts and hard span and scale limits', () => {
    expect(
      resolveMinimumZoomSpan(boundary, [sparse, dense], { ...options, minVisiblePoints: 3 }),
    ).toBeCloseTo(1)
    expect(
      constrainZoomDomain([4.9, 5.1], boundary, [sparse, dense], {
        ...options,
        minVisiblePoints: 0,
      }),
    ).toEqual([4.9, 5.1])
    for (const limits of [{ minZoomSpan: 2 }, { maxZoomScale: 5 }]) {
      const domain = constrainZoomDomain([4.9, 5.1], boundary, [sparse, dense], {
        ...options,
        ...limits,
      })
      expect(domain[1] - domain[0]).toBeCloseTo(2)
    }
  })

  it('breaks equal spans by proximity, then frame order, and preserves integer constraints', () => {
    const requested: [number, number] = [4.8, 5.2]
    const domain = constrainZoomDomain(
      requested,
      boundary,
      [group([3, 5.2]), group([4.8, 7])],
      options,
    )
    expect(domain[0]).toBeCloseTo(3)
    expect(domain[1]).toBeCloseTo(5.2)
    const integerDomain = constrainZoomDomain([4.9, 5.1], boundary, [sparse, dense], {
      ...options,
      integerZoom: true,
      timeUnit: 's',
    })
    expect(count([4, 4.5, 5, 5.5, 6], integerDomain)).toBeGreaterThanOrEqual(2)
    expect(integerDomain[1] - integerDomain[0]).toBeLessThan(10)
  })

  const cases = (['separated', 'compact'] as const).flatMap((displayMode) =>
    (['wheel', 'button', 'box'] as const).flatMap((gesture) =>
      [false, true].map((remote) => ({ displayMode, gesture, remote })),
    ),
  )
  it.each(cases)(
    'continues until the last frame reaches its limit ($displayMode/$gesture/$remote)',
    async ({ displayMode, gesture, remote }) => {
      const data = (emptySparse = false) => ({
        kind: 'series' as const,
        series: [sparse, dense].map((series, index) => ({
          id: `channel-${index}`,
          name: `Channel ${index}`,
          data: { kind: 'points' as const, points: emptySparse && !index ? [] : series[0]!.points },
        })),
      })
      const w = await mountSizedChart(data(), {
        ...options,
        displayMode,
        initialXDomain: boundary,
        ...(remote ? { panXDomain: boundary } : {}),
      })
      try {
        resizeChart(320, 300)
        await flushPromises()
        const initialTargets = w.vm.getControlState().targets.map((t) => t.trackId)
        const overlay = w.get('.waveform-chart__overlay')
        const width = Number(overlay.attributes('width'))
        const height = Number(overlay.attributes('height'))
        Object.defineProperty(overlay.element, 'getBoundingClientRect', {
          value: () => ({ left: 0, top: 0, width, height }),
        })
        const domain = () => w.vm.getControlState().targets[0]!.viewport.xDomain
        const zoom = async () => {
          if (gesture === 'button') w.vm.zoomIn()
          else if (gesture === 'wheel') {
            overlay.element.dispatchEvent(
              new WheelEvent('wheel', {
                deltaY: -1,
                clientX: width / 2,
                clientY: height / 2,
                bubbles: true,
                cancelable: true,
              }),
            )
            flushAnimationFrames()
          } else {
            for (const [type, ratio] of [
              ['pointerdown', 0.25],
              ['pointerup', 0.75],
            ] as const) {
              const event = new MouseEvent(type, {
                button: 0,
                clientX: width * ratio,
                clientY: height / 2,
                bubbles: true,
              })
              Object.defineProperty(event, 'pointerId', { value: 81 })
              overlay.element.dispatchEvent(event)
            }
          }
          await flushPromises()
        }
        await zoom()
        expect(domain()[1] - domain()[0]).toBeLessThan(10)
        expect(count([0, 10], domain())).toBe(0)
        await w.setProps({ data: data(true) })
        for (let step = 0; step < 30; step++) await zoom()
        expect(domain()[1] - domain()[0]).toBeCloseTo(0.5, 10)
        expect(count([4, 4.5, 5, 5.5, 6], domain())).toBe(2)
        const limited = [...domain()]
        await zoom()
        expect(domain()).toEqual(limited)
        expect(w.vm.getControlState().targets.map((t) => t.trackId)).toEqual(initialTargets)
        expect(
          w.vm
            .getControlState()
            .targets.every((t) =>
              t.viewport.xDomain.every((x, i) => Math.abs(x - domain()[i]!) < 1e-10),
            ),
        ).toBe(true)
        await w.setProps({ data: data() })
        expect(domain()).toEqual(limited)
        w.vm.zoomOut()
        await flushPromises()
        expect(domain()[1] - domain()[0]).toBeGreaterThan(0.5)
      } finally {
        w.unmount()
      }
    },
  )
})

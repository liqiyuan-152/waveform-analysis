import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { mountSizedChart } from '../../test/waveformChart'

const regularPoints = Array.from({ length: 1_200 }, (_, index) => ({ x: index, y: index % 11 }))

function visibleXCount(domain: [number, number], values = regularPoints): number {
  return new Set(
    values.filter((point) => point.x >= domain[0] && point.x <= domain[1]).map((point) => point.x),
  ).size
}

function prepareOverlay(wrapper: VueWrapper, selector: string) {
  const overlay = wrapper.get(selector)
  const width = Number(overlay.attributes('width'))
  const height = Number(overlay.attributes('height'))
  Object.defineProperty(overlay.element, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width, height }),
  })
  return { overlay, width, height }
}

async function dispatchWheel(
  overlay: ReturnType<VueWrapper['get']>,
  width: number,
  height: number,
  deltaY: number,
) {
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
  await flushPromises()
}

function dispatchBox(
  overlay: ReturnType<VueWrapper['get']>,
  startX: number,
  endX: number,
  height: number,
  pointerId: number,
) {
  for (const [type, clientX] of [
    ['pointerdown', startX],
    ['pointermove', endX],
    ['pointerup', endX],
  ] as const) {
    const event = new MouseEvent(type, {
      button: 0,
      clientX,
      clientY: height / 2,
      bubbles: true,
    })
    Object.defineProperty(event, 'pointerId', { value: pointerId })
    overlay.element.dispatchEvent(event)
  }
}

describe('WaveformChart point-aware zoom constraints', () => {
  it('wheel-zooms 1,200 samples to two distinct X values, stops, and still zooms out', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'points', points: regularPoints },
      { minVisiblePoints: 2 },
    )
    const { overlay, width, height } = prepareOverlay(
      wrapper,
      '.waveform-chart__overlay--independent',
    )

    await dispatchWheel(overlay, width, height, -4_000)
    await dispatchWheel(overlay, width, height, -4_000)
    const twoPointDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(visibleXCount(twoPointDomain)).toBe(2)

    const eventCount = wrapper.emitted('zoom-change')?.length ?? 0
    await dispatchWheel(overlay, width, height, -1_000)
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(eventCount)

    await dispatchWheel(overlay, width, height, 4_000)
    const partiallyZoomedOut = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(partiallyZoomedOut[1] - partiallyZoomedOut[0]).toBeGreaterThan(
      twoPointDomain[1] - twoPointDomain[0],
    )
    await dispatchWheel(overlay, width, height, 4_000)
    const fullyZoomedOut = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(fullyZoomedOut).toEqual([0, 1_199])
  })

  it('keeps two fractional samples when the wheel focus falls between sample positions', async () => {
    const points = Array.from({ length: 1_000 }, (_, index) => ({
      x: -5 + (index * 10) / 999,
      y: index,
    }))
    const wrapper = await mountSizedChart(
      { kind: 'points', points },
      { minVisiblePoints: 2, initialXDomain: [-5, 5] },
    )
    const { overlay, width, height } = prepareOverlay(
      wrapper,
      '.waveform-chart__overlay--independent',
    )

    for (let index = 0; index < 3; index += 1) {
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -4_000,
          clientX: width * 0.5032,
          clientY: height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
    }

    const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(visibleXCount(domain, points)).toBe(2)
  })

  it('uses repeated box zooms to reach exactly two distinct X values', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'points', points: regularPoints },
      { minVisiblePoints: 2 },
    )
    const { overlay, width, height } = prepareOverlay(
      wrapper,
      '.waveform-chart__overlay--independent',
    )

    for (let index = 0; index < 3; index += 1) {
      dispatchBox(overlay, width / 2 - 4, width / 2 + 4, height, index + 1)
      await flushPromises()
    }

    const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(visibleXCount(domain)).toBe(2)
    const eventCount = wrapper.emitted('zoom-change')?.length ?? 0
    dispatchBox(overlay, width / 2 - 4, width / 2 + 4, height, 10)
    await flushPromises()
    const constrainedDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(eventCount)
    expect(visibleXCount(constrainedDomain)).toBe(2)
  })

  it('retains the default 40x maximum when no explicit limit is configured', async () => {
    const wrapper = await mountSizedChart({ kind: 'points', points: regularPoints })
    const { overlay, width, height } = prepareOverlay(
      wrapper,
      '.waveform-chart__overlay--independent',
    )

    await dispatchWheel(overlay, width, height, -4_000)
    const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(domain[1] - domain[0]).toBeCloseTo(1_199 / 40)
  })

  it('retains two endpoint samples while replacing an independent data window', async () => {
    const sourcePoints = Array.from({ length: 1_000 }, (_, index) => ({
      x: -5 + (index * 10) / 999,
      y: index,
    }))
    const wrapper = await mountSizedChart(
      { kind: 'points', points: sourcePoints },
      { minVisiblePoints: 2, initialXDomain: [-5, 5] },
    )
    const { overlay, width, height } = prepareOverlay(
      wrapper,
      '.waveform-chart__overlay--independent',
    )
    for (let index = 0; index < 10; index += 1) {
      const eventCount = wrapper.emitted('zoom-change')?.length ?? 0
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -1_000,
          clientX: width * 0.5032,
          clientY: height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
      if ((wrapper.emitted('zoom-change')?.length ?? 0) === eventCount) break
      const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
      const windowPoints = sourcePoints.filter(
        (point) => point.x >= domain[0] && point.x <= domain[1],
      )
      await wrapper.setProps({ data: { kind: 'points', points: windowPoints } })
      await flushPromises()
    }

    const finalDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    const endpointDomain = wrapper
      .findAll('.waveform-chart__axis-endpoint')
      .slice(0, 2)
      .map((endpoint) => Number(endpoint.text()) / 1_000) as [number, number]
    expect(visibleXCount(finalDomain, sourcePoints)).toBe(2)
    expect(visibleXCount(endpointDomain, sourcePoints)).toBe(2)
    const eventCount = wrapper.emitted('zoom-change')?.length ?? 0
    await dispatchWheel(overlay, width, height, -1_000)
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(eventCount)
  })

  it('recomputes irregular point constraints for shared tracks after data replacement', async () => {
    const createData = (offset: number) => ({
      kind: 'series' as const,
      series: [
        {
          id: 'first',
          name: 'First',
          data: {
            kind: 'points' as const,
            points: [0, 1, 4, 20].map((x) => ({ x: x + offset, y: x })),
          },
        },
        {
          id: 'second',
          name: 'Second',
          data: {
            kind: 'points' as const,
            points: [0, 3, 9, 20].map((x) => ({ x: x + offset, y: x })),
          },
        },
      ],
    })
    const wrapper = await mountSizedChart(createData(0), {
      displayMode: 'separated',
      minVisiblePoints: 2,
    })
    const { overlay, width, height } = prepareOverlay(wrapper, '.waveform-chart__overlay')

    await dispatchWheel(overlay, width, height, -4_000)
    await wrapper.setProps({ data: createData(100) })
    await flushPromises()
    await dispatchWheel(overlay, width, height, 4_000)
    const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(domain).toEqual([100, 120])
  })
})

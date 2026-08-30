import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { mountSizedChart } from '../../test/waveformChart'

function densePoints(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    x: index,
    y: index === count - 1 ? 100 : Math.sin(index / 10),
  }))
}

async function samplingEvents(count: number, rendering = {}) {
  const wrapper = await mountSizedChart(
    { kind: 'points', points: densePoints(count) },
    { rendering, grid: { rowCount: 1, columnCount: 1 } },
  )
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 120))
  return wrapper
}

async function compactSamplingEvents(count: number, rendering = {}) {
  const wrapper = await mountSizedChart(
    {
      kind: 'typed-points',
      x: Float64Array.from({ length: count }, (_, index) => index),
      y: Float32Array.from({ length: count }, (_, index) =>
        index === count - 1 ? 100 : Math.sin(index / 10),
      ),
    },
    { rendering, grid: { rowCount: 1, columnCount: 1 } },
  )
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 120))
  return wrapper
}

describe('WaveformChart worker sampling integration', () => {
  it('uses raw source points at the auto threshold and JavaScript fallback above it', async () => {
    const threshold = await samplingEvents(1_000)
    const sampled = await samplingEvents(1_001)

    expect(threshold.emitted('sampling-complete')?.at(-1)?.[0]).toMatchObject({
      mode: 'auto',
      backend: 'raw',
      visiblePointCount: 1_000,
      renderedPointCount: 1_000,
    })
    expect(sampled.emitted('sampling-complete')?.at(-1)?.[0]).toMatchObject({
      mode: 'auto',
      backend: 'javascript',
      visiblePointCount: 1_001,
    })
    const path = sampled.get('.waveform-chart__line').attributes('d') ?? ''
    expect(path.match(/[ML]/g)?.length).toBeLessThan(4_000)
  })

  it('bypasses worker sampling in raw mode and reports a forced-WASM failure without a fallback', async () => {
    const raw = await samplingEvents(1_001, { sampling: { mode: 'raw' } })
    const wasm = await samplingEvents(1_001, {
      sampling: { mode: 'wasm', wasmFailureFallback: 'error' },
    })

    expect(raw.emitted('sampling-complete')?.at(-1)?.[0]).toMatchObject({
      mode: 'raw',
      backend: 'raw',
      renderedPointCount: 1_001,
    })
    expect(raw.emitted('sampling-error')).toBeUndefined()
    expect(wasm.emitted('sampling-complete')?.at(-1)?.[0]).toMatchObject({
      mode: 'wasm',
      backend: 'unavailable',
    })
    expect(wasm.emitted('sampling-error')?.at(-1)?.[0]).toMatchObject({
      mode: 'wasm',
      fallback: 'none',
    })
  })

  it('keeps hover bound to complete source data after sampled SVG geometry is applied', async () => {
    const wrapper = await samplingEvents(1_001)
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: width, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1_000, y: 100 }])
  })

  it('samples dense typed coordinates while retaining the full compact source for hover', async () => {
    const wrapper = await compactSamplingEvents(1_001)
    expect(wrapper.emitted('sampling-complete')?.at(-1)?.[0]).toMatchObject({
      backend: 'javascript',
      sourcePointCount: 1_001,
      visiblePointCount: 1_001,
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: width, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1_000, y: 100 }])
  })
})

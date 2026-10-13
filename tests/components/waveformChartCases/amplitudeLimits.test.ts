import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mountSizedChart, gridSeries } from '@tests/support/waveformChart'
import { flushAnimationFrames, resizeObservers } from '@tests/support/setup'
import { normalizeWaveformSeries, type WaveformData, type WaveformAmplitudeLimit } from '@/index'

function data(min = -200, max = 200): WaveformData {
  return {
    kind: 'series',
    series: [
      {
        id: 'a',
        name: 'A',
        data: {
          kind: 'points',
          points: [
            { x: 0, y: min },
            { x: 1, y: (min + max) / 2 },
            { x: 2, y: max },
          ],
        },
      },
    ],
  }
}
type Chart = Awaited<ReturnType<typeof mountSizedChart>>
async function finishDataAnimation() {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 1000)
  try {
    flushAnimationFrames()
    await flushPromises()
  } finally {
    clock.mockRestore()
  }
}
function domains(w: Chart) {
  return w
    .findAll('.waveform-track__axis--y')
    .map((axis) => [
      Number(axis.attributes('data-label-domain-min')),
      Number(axis.attributes('data-label-domain-max')),
    ])
}
function bounds(w: Chart) {
  const overlay = w.get('.waveform-chart__overlay')
  const width = Number(overlay.attributes('width')),
    height = Number(overlay.attributes('height'))
  Object.defineProperty(overlay.element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width, height }),
  })
  return { overlay, width, height }
}
async function drag(w: Chart, vertical = false) {
  const { overlay, width, height } = bounds(w)
  for (const [type, x, y] of [
    ['pointerdown', width * 0.25, height * 0.25],
    ['pointermove', width * 0.75, height * 0.75],
    ['pointerup', width * 0.75, height * 0.75],
  ] as const) {
    const event = new MouseEvent(type, {
      clientX: vertical ? width / 2 : x,
      clientY: y,
      button: 0,
      bubbles: true,
    })
    Object.defineProperty(event, 'pointerId', { value: 9 })
    overlay.element.dispatchEvent(event)
    await flushPromises()
  }
  flushAnimationFrames()
  await flushPromises()
}

describe('WaveformChart amplitude limits', () => {
  it('falls back to the legacy API for invalid limits and treats zero as a strict bound', async () => {
    const w = await mountSizedChart(data(), {
      yDomains: { a: [-73, 86] },
      grid: { rowCount: 1 },
    })
    expect(domains(w)).toEqual([[-100, 100]])
    for (const limit of [
      { lower: 3, upper: 3 },
      { lower: 4, upper: 3 },
      { lower: NaN, upper: Infinity },
    ]) {
      await w.setProps({ amplitudeLimits: { a: limit } })
      await flushPromises()
      expect(domains(w)).toEqual([[-100, 100]])
    }
    await w.setProps({ amplitudeLimits: { a: { lower: -Infinity, upper: 0 } } })
    await flushPromises()
    expect(domains(w)).toEqual([[-200, 0]])
    w.unmount()
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'keeps strict nice bounds through gestures, commands, data updates and resize in %s',
    async (displayMode) => {
      const source = data(),
        original = structuredClone(source)
      const w = await mountSizedChart(source, {
        displayMode,
        grid: { rowCount: 1 },
        pannable: true,
        amplitudeLimits: { a: { lower: -73, upper: 86 } },
      })
      const check = () => expect(domains(w)).toEqual([[-73, 86]])
      check()
      const ticks = w
        .findAll('.waveform-track__axis--y .tick')
        .map((t) => Number(t.attributes('data-tick-value')))
      expect(ticks.length).toBeGreaterThan(1)
      expect(ticks.every((v) => v >= -73 && v <= 86)).toBe(true)
      await drag(w)
      expect(w.emitted('zoom-end')?.at(-1)?.[0]).toMatchObject({ gesture: 'box' })
      check()
      const { overlay, width, height } = bounds(w)
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -400,
          clientX: width / 2,
          clientY: height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
      check()
      await w.setProps({ interactionMode: 'pan' })
      await flushPromises()
      await drag(w, true)
      await drag(w)
      expect(w.emitted('pan-end')?.length).toBeGreaterThan(0)
      check()
      for (const command of [
        () => w.vm.zoomIn(),
        () => w.vm.zoomOut(),
        () => w.vm.resetViewport(),
        () => w.vm.fitToData(),
      ]) {
        command()
        await flushPromises()
        check()
      }
      await w.setProps({ data: data(500, 1000) })
      await flushPromises()
      await finishDataAnimation()
      check()
      expect(w.get('.waveform-chart__line').attributes('d')).toMatch(/^M[^,]+,-/)
      expect(w.find('[clip-path]').exists()).toBe(true)
      resizeObservers.at(-1)?.resize(260, 180)
      await flushPromises()
      check()
      expect(source).toEqual(original)
      expect(normalizeWaveformSeries(source)[0]!.points.map((p) => p.y)).toEqual([-200, 0, 200])
      expect(w.find('clipPath').exists()).toBe(true)
      w.unmount()
    },
  )

  it.each([
    [{ lower: 0 }, [0, 86], [0, 155]],
    [{ upper: 70 }, [14, 70], [20, 70]],
  ] as [WaveformAmplitudeLimit, number[], number[]][])(
    'keeps the automatic side live for %o and restores automatic behavior when removed',
    async (limit, first, updated) => {
      const w = await mountSizedChart(data(20, 80), {
        grid: { rowCount: 1 },
        pannable: true,
        interactionMode: 'pan',
        amplitudeLimits: { a: limit },
        axes: { y: { nice: false, upperPaddingEnabled: true, lowerPaddingEnabled: true } },
      })
      // The middle sample is zero; use two nonzero samples for exact automatic bounds.
      const twoPoints = (min: number, max: number): WaveformData => ({
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: min },
                { x: 2, y: max },
              ],
            },
          },
        ],
      })
      await w.setProps({ data: twoPoints(20, 80) })
      await flushPromises()
      expect(domains(w)).toEqual([first])
      await drag(w, true)
      expect(domains(w)).toEqual([first])
      await w.setProps({ data: twoPoints(100, 150) })
      await flushPromises()
      await finishDataAnimation()
      expect(domains(w)).toEqual([updated])
      w.vm.resetViewport()
      await flushPromises()
      expect(domains(w)).toEqual([updated])
      await w.setProps({ amplitudeLimits: {} })
      await flushPromises()
      expect(domains(w)).toEqual([[95, 155]])
      w.unmount()
    },
  )

  it('uses series IDs across pagination, config replacement and data reordering', async () => {
    const w = await mountSizedChart(gridSeries(2), {
      grid: { rowCount: 1 },
      amplitudeLimits: {
        'channel-0': { lower: -73, upper: 86 },
        'channel-1': { lower: 0, upper: 10 },
      },
    })
    expect(domains(w)).toEqual([[-73, 86]])
    await w.get('.ant-pagination-next button').trigger('click')
    expect(domains(w)).toEqual([[0, 10]])
    await w.setProps({ amplitudeLimits: { 'channel-1': { lower: -10, upper: 20 } } })
    await flushPromises()
    expect(domains(w)).toEqual([[-10, 20]])
    const reordered = gridSeries(2)
    if (reordered.kind === 'series') reordered.series.reverse()
    await w.setProps({ data: reordered })
    await flushPromises()
    await w.get('.ant-pagination-prev button').trigger('click')
    expect(domains(w)).toEqual([[-10, 20]])
    w.unmount()
  })

  it('merges shared axes, respects hidden series and preserves all-hidden defaults', async () => {
    const source = gridSeries(2)
    if (source.kind === 'series')
      source.series.forEach((s) => {
        s.trackId = 'shared'
      })
    const w = await mountSizedChart(source, {
      amplitudeLimits: {
        'channel-0': { lower: -73, upper: 86 },
        'channel-1': { lower: -100, upper: 200 },
      },
    })
    expect(domains(w)).toEqual([[-100, 200]])
    await w.setProps({ overlayMode: 'multi-axis' })
    await flushPromises()
    expect(domains(w)).toEqual([
      [-73, 86],
      [-100, 200],
    ])
    await w.setProps({ hiddenSeriesIds: ['channel-1'], overlayMode: 'single-axis' })
    await flushPromises()
    expect(domains(w)).toEqual([[-73, 86]])
    await w.setProps({ hiddenSeriesIds: ['channel-0', 'channel-1'] })
    await flushPromises()
    expect(domains(w)).toEqual([[-100, 200]])
    w.unmount()
  })

  it('preserves empty-data defaults without creating axes for absent series', async () => {
    const w = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
            data: {
              kind: 'points',
              points: [],
            },
          },
        ],
      },
      { amplitudeLimits: { a: { lower: -73, upper: 86 } } },
    )
    expect(domains(w)).toEqual([])
    await w.setProps({ data: { kind: 'series', series: [] } })
    await flushPromises()
    expect(w.find('.waveform-chart').exists()).toBe(true)
    expect(domains(w).every((d) => d.every(Number.isFinite))).toBe(true)
    w.unmount()
  })
})

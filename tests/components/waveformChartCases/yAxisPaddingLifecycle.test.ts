import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames } from '@tests/support/setup'
import type { WaveformData } from '@/types'

const data: WaveformData = {
  kind: 'series',
  series: [
    {
      id: 'a',
      name: 'A',
      trackId: 'both',
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 20 },
          { x: 1, y: 80 },
        ],
      },
    },
    {
      id: 'b',
      name: 'B',
      trackId: 'both',
      data: {
        kind: 'points',
        points: [
          { x: 0, y: -200 },
          { x: 1, y: -100 },
        ],
      },
    },
  ],
}
const maxima = (w: Awaited<ReturnType<typeof mountSizedChart>>) =>
  w.findAll('[data-maximum-tick]').map((t) => Number(t.attributes('data-tick-value')))

function drag(element: Element, x: number, from: number, to: number) {
  for (const [type, y] of [
    ['pointerdown', from],
    ['pointermove', to],
    ['pointerup', to],
  ] as const) {
    const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true })
    Object.defineProperty(event, 'pointerId', { value: 9 })
    element.dispatchEvent(event)
  }
}

describe('Y padding lifecycle and axis grouping', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'uses each axis range in %s, and refreshes hidden series',
    async (displayMode) => {
      const w = await mountSizedChart(data, {
        displayMode,
        overlayMode: 'multi-axis',
        axes: { y: { nice: false, upperPaddingEnabled: true, lowerPaddingEnabled: true } },
        grid: { rowCount: 1 },
      })
      expect(maxima(w)).toEqual([80, -100])
      const ranges = w
        .findAll('.waveform-track__axis--y')
        .map((axis) => axis.findAll('.tick').map((t) => Number(t.attributes('data-tick-value'))))
      expect([ranges[0]![0], ranges[0]!.at(-1)]).toEqual([14, 86])
      expect([ranges[1]![0], ranges[1]!.at(-1)]).toEqual([-210, -90])
      await w.setProps({ hiddenSeriesIds: ['a'] })
      await flushPromises()
      expect(maxima(w)).toEqual([-100])
      w.unmount()
    },
  )
  it('keeps manual Y panning independent of padding changes and restores on fit', async () => {
    const w = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 100 },
        ],
      },
      {
        interactionMode: 'pan',
        pannable: true,
        grid: { rowCount: 1 },
        axes: { y: { nice: false, upperPaddingEnabled: true } },
      },
    )
    const overlay = w.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width')),
      height = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    drag(overlay.element, width / 2, height / 2, height / 2 + 20)
    flushAnimationFrames()
    await flushPromises()
    const range = () =>
      w.findAll('.waveform-track__axis--y .tick').map((t) => t.attributes('data-tick-value'))
    const manual = range()
    await w.setProps({ axes: { y: { nice: false, upperPaddingRatio: 0.5 } } })
    await flushPromises()
    expect(range()).toEqual(manual)
    w.vm.fitToData()
    await flushPromises()
    const ticks = w
      .findAll('.waveform-track__axis--y .tick')
      .map((t) => Number(t.attributes('data-tick-value')))
    expect(ticks.at(-1)).toBe(150)
    expect(maxima(w)).toEqual([100])
    w.unmount()
  })
  it('uses full error endpoints and keeps marker hidden for lower-only padding', async () => {
    const w = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'error',
            name: 'Error',
            errorBar: { visible: true },
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 100, upperError: 20 },
              ],
            },
          },
        ],
      },
      { axes: { y: { nice: false, upperPaddingRatio: 0.1 } } },
    )
    expect(maxima(w)).toEqual([120])
    await w.setProps({ axes: { y: { nice: false, lowerPaddingEnabled: true } } })
    await flushPromises()
    expect(maxima(w)).toEqual([])
    w.unmount()
  })
})

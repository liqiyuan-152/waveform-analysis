import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames } from '@tests/support/setup'
import type { WaveformData } from '@/types'

const data: WaveformData = {
  kind: 'points',
  points: [
    { x: 0, y: -73 },
    { x: 1, y: 86 },
  ],
}
const padding = { nice: true, upperPaddingRatio: 0.1, lowerPaddingRatio: 0.1 }
function domains(w: Awaited<ReturnType<typeof mountSizedChart>>) {
  return w
    .findAll('.waveform-track__axis--y')
    .map((axis) => [
      Number(axis.attributes('data-label-domain-min')),
      Number(axis.attributes('data-label-domain-max')),
    ])
}

describe('exact nice padding chart behavior', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'renders exact bounds and refreshes in %s',
    async (displayMode) => {
      const w = await mountSizedChart(data, {
        displayMode,
        animationEnabled: false,
        axes: { y: padding },
      })
      expect(domains(w)).toEqual([[-88.9, 101.9]])
      expect(
        w.findAll('[data-maximum-tick]').map((t) => Number(t.attributes('data-tick-value'))),
      ).toEqual([86])
      expect(
        w.findAll('[data-minimum-tick]').map((t) => Number(t.attributes('data-tick-value'))),
      ).toEqual([-73])
      await w.setProps({
        data: {
          kind: 'points',
          points: [
            { x: 0, y: 20 },
            { x: 1, y: 80 },
          ],
        },
      })
      await flushPromises()
      expect(domains(w)).toEqual([[14, 86]])
      w.vm.fitToData()
      await flushPromises()
      expect(domains(w)).toEqual([[14, 86]])
      await w.setProps({ axes: { y: { ...padding, upperPaddingEnabled: false } } })
      await flushPromises()
      expect(domains(w)).toEqual([[14, 80]])
      w.unmount()
    },
  )
  it('preserves manual nice viewports across padding changes and restores on fit', async () => {
    const w = await mountSizedChart(data, {
      animationEnabled: false,
      interactionMode: 'pan',
      pannable: true,
      axes: { y: padding },
      grid: { rowCount: 1 },
    })
    const overlay = w.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width')),
      height = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    for (const [type, y] of [
      ['pointerdown', height / 2],
      ['pointermove', height / 2 + 20],
      ['pointerup', height / 2 + 20],
    ] as const) {
      const event = new MouseEvent(type, {
        clientX: width / 2,
        clientY: y,
        button: 0,
        bubbles: true,
      })
      Object.defineProperty(event, 'pointerId', { value: 9 })
      overlay.element.dispatchEvent(event)
    }
    flushAnimationFrames()
    await flushPromises()
    const manual = domains(w)
    expect(manual).not.toEqual([[-88.9, 101.9]])
    await w.setProps({
      axes: { y: { nice: true, upperPaddingRatio: 0.5, lowerPaddingRatio: 0.5 } },
    })
    await flushPromises()
    expect(domains(w)).toEqual(manual)
    w.vm.fitToData()
    await flushPromises()
    expect(domains(w)).toEqual([[-152.5, 165.5]])
    w.unmount()
  })
  it('uses each visible multi-axis range and refreshes visibility', async () => {
    const w = await mountSizedChart(
      {
        kind: 'series',
        series: [
          { id: 'a', name: 'A', trackId: 'both', data },
          {
            id: 'b',
            name: 'B',
            trackId: 'both',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 20 },
                { x: 1, y: 80 },
              ],
            },
          },
        ],
      },
      { overlayMode: 'multi-axis', axes: { y: padding } },
    )
    expect(domains(w)).toEqual([
      [-88.9, 101.9],
      [14, 86],
    ])
    await w.setProps({ hiddenSeriesIds: ['a'] })
    await flushPromises()
    expect(domains(w)).toEqual([[14, 86]])
    w.unmount()
  })
  it('keeps a nonzero range for constants and uses enabled error endpoints', async () => {
    const constant = await mountSizedChart(
      { kind: 'points', points: [{ x: 0, y: 5 }] },
      { axes: { y: padding } },
    )
    expect(domains(constant)).toEqual([[4.7, 5.3]])
    constant.unmount()
    const errors = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
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
      { axes: { y: padding } },
    )
    expect(domains(errors)).toEqual([[-12, 132]])
    errors.unmount()
  })
})

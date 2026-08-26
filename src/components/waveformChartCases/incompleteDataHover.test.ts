import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart incomplete data hover', () => {
  it('keeps the shared crosshair at the query time and marks out-of-range series unavailable', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: '完整数据',
            data: {
              kind: 'points',
              points: [
                { x: -1, y: 1 },
                { x: -0.5, y: 2 },
                { x: 1, y: 3 },
              ],
            },
          },
          {
            name: '从零开始',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 10 },
                { x: 1, y: 20 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated' },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--shared')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: overlayWidth / 4,
        clientY: 120,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    const crosshairPositions = wrapper
      .findAll('.waveform-chart__crosshair line')
      .map((line) => Number(line.attributes('x1')))
    expect(crosshairPositions).toHaveLength(2)
    expect(crosshairPositions[0]).toBeCloseTo(overlayWidth / 4)
    expect(crosshairPositions[1]).toBeCloseTo(overlayWidth / 4)
    const tooltipRows = wrapper.findAll('.waveform-chart__tooltip-series')
    expect(tooltipRows).toHaveLength(2)
    expect(tooltipRows[0].text()).toContain('(x:-500 y:2)')
    expect(tooltipRows[1].text()).toContain('无数据')
    expect(tooltipRows[1].text()).not.toContain('x:')
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: -0.5, y: 2 }])
  })
})

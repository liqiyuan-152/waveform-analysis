import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart incomplete data hover', () => {
  it.each(['separated', 'compact'] as const)(
    'clamps each track crosshair and tooltip values to data endpoints in %s mode',
    async (displayMode) => {
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
        { displayMode },
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
      expect(crosshairPositions[1]).toBeCloseTo(overlayWidth / 2)
      const tooltipRows = wrapper.findAll('.waveform-chart__tooltip-series')
      expect(tooltipRows).toHaveLength(2)
      expect(tooltipRows[0].text()).toContain('(x:-500 y:2)')
      expect(tooltipRows[1].text()).toContain('(x:0 y:10)')
      expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: -0.5, y: 2 }])
    },
  )

  it.each(['separated', 'compact'] as const)(
    'uses the longest series for a shared track crosshair while clamping each tooltip row in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [
            {
              name: '范围参考',
              data: {
                kind: 'points',
                points: [
                  { x: -2, y: 1 },
                  { x: 2, y: 2 },
                ],
              },
            },
            {
              name: '最长曲线',
              trackId: 'same-track',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 10 },
                  { x: 1, y: 20 },
                ],
              },
            },
            {
              name: '较短曲线',
              trackId: 'same-track',
              data: {
                kind: 'points',
                points: [
                  { x: 0.25, y: 30 },
                  { x: 0.5, y: 40 },
                ],
              },
            },
          ],
        },
        { displayMode },
      )
      const overlay = wrapper.get('.waveform-chart__overlay--shared')
      const overlayWidth = Number(overlay.attributes('width'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
      })

      overlay.element.dispatchEvent(
        new MouseEvent('pointermove', {
          clientX: overlayWidth / 8,
          clientY: 120,
          bubbles: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()

      let crosshairPositions = wrapper
        .findAll('.waveform-chart__crosshair line')
        .map((line) => Number(line.attributes('x1')))
      expect(crosshairPositions).toHaveLength(2)
      expect(crosshairPositions[1]).toBeCloseTo(overlayWidth / 2)
      expect(wrapper.text()).toContain('最长曲线(x:0 y:10)')
      expect(wrapper.text()).toContain('较短曲线(x:250 y:30)')

      overlay.element.dispatchEvent(
        new MouseEvent('pointermove', {
          clientX: (overlayWidth * 7) / 8,
          clientY: 120,
          bubbles: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()

      crosshairPositions = wrapper
        .findAll('.waveform-chart__crosshair line')
        .map((line) => Number(line.attributes('x1')))
      expect(crosshairPositions[1]).toBeCloseTo((overlayWidth * 3) / 4)
      expect(wrapper.text()).toContain('最长曲线(x:1,000 y:20)')
      expect(wrapper.text()).toContain('较短曲线(x:500 y:40)')
    },
  )
})

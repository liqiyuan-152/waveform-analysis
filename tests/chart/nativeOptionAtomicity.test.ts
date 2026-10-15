import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformChartOptionUpdate } from '@/types/options'
import { flushNativeUpdates } from '../support/nativeChart'
import { pendingAnimationFrameCount, resizeObservers } from '../support/setup'

let chart: WaveformChartInstance | undefined
afterEach(() => {
  chart?.dispose()
  chart = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('public configuration transaction', () => {
  it.each([
    { data: { kind: 'unknown' } },
    { data: { kind: 'typed-samples', values: new DataView(new ArrayBuffer(8)), sampleRate: 2 } },
    { data: { kind: 'points', points: [{ x: 10, y: 8 }] }, width: 'bad' },
    { axes: { x: { labelFormatter: 'bad' } } },
  ])(
    'rejects mixed invalid updates without resources, state or success events: %#',
    async (bad) => {
      const host = document.createElement('div')
      document.body.append(host)
      const rect = { width: 800, height: 400 } as DOMRect
      vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(rect)
      vi.spyOn(host, 'getClientRects').mockReturnValue([rect] as unknown as DOMRectList)
      const data = Object.freeze({
        kind: 'points' as const,
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 1 },
        ],
      })
      data.points.forEach((point) => Object.freeze(point))
      Object.freeze(data.points)
      chart = init(host, { data, width: 800, height: 400, animationEnabled: false })
      await flushNativeUpdates()
      chart.setViewportDomain([0.5, 1.5])
      await flushNativeUpdates()
      const state = chart.getControlState()
      const markup = host.innerHTML
      const observerCount = resizeObservers.length
      const rendered = vi.fn()
      const finished = vi.fn()
      const control = vi.fn()
      chart.on('rendered', rendered)
      chart.on('finished', finished)
      chart.on('control-state-change', control)
      expect(() =>
        chart!.setOption({ lineColor: 'red', ...bad } as unknown as WaveformChartOptionUpdate),
      ).toThrow(
        expect.objectContaining({
          code: 'invalid-option',
          field: bad.width ? 'width' : bad.axes ? 'axes' : 'data',
        }),
      )
      expect(chart.getControlState()).toEqual(state)
      expect(pendingAnimationFrameCount()).toBe(0)
      expect(resizeObservers.length).toBe(observerCount)
      await flushNativeUpdates()
      expect(host.innerHTML).toBe(markup)
      expect(rendered).not.toHaveBeenCalled()
      expect(finished).not.toHaveBeenCalled()
      expect(control).not.toHaveBeenCalled()
      // A subsequent valid update still applies, and uses its new data synchronously.
      chart.setOption({
        data: {
          kind: 'points',
          points: [
            { x: 10, y: 1 },
            { x: 20, y: 2 },
          ],
        },
      })
      chart.setViewportDomain([12, 14])
      expect(chart.getControlState().targets[0]?.viewport.xDomain).toEqual([12, 14])
      await flushNativeUpdates()
      expect(finished).toHaveBeenCalledOnce()
    },
  )
})

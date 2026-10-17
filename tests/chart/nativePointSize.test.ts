import { afterEach, describe, expect, it } from 'vitest'
import { symbol, symbolCircle, symbolSquare, symbolTriangle, symbolDiamond } from 'd3'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformData, WaveformPointType } from '@/types'
import { flushVueChartUpdates } from '../support/waveformChart'
import { flushNativeUpdates } from '../support/nativeChart'

const instances: WaveformChartInstance[] = []
afterEach(() => instances.splice(0).forEach((instance) => instance.dispose()))

function data(
  pointSize?: number,
  pointType: WaveformPointType = 'circle',
  line = true,
): WaveformData {
  return {
    kind: 'series',
    series: [
      {
        id: 'a',
        trackId: 'track',
        name: 'A',
        pointType,
        pointSize,
        lineType: line ? 'linear' : 'none',
        data: {
          kind: 'points',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      },
      {
        id: 'b',
        trackId: 'track',
        name: 'B',
        data: {
          kind: 'points',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      },
    ],
  }
}

async function chart(options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  const instance = init(
    host,
    {
      width: 800,
      height: 400,
      animationEnabled: false,
      unitDisplayMode: 'legend-single-series',
      grid: { rowCount: 1, columnCount: 1 },
      data: data(),
      ...options,
    },
    { autoResize: false },
  )
  instances.push(instance)
  if (options.animationEnabled) await flushVueChartUpdates()
  else await flushNativeUpdates()
  const pointPath = () => host.querySelector('.waveform-chart__point')!.getAttribute('d')!
  const radius = () => Number(pointPath().match(/A([^,]+)/)![1])
  return { host, instance, pointPath, radius }
}

describe('native point size', () => {
  it('defaults to a 2px diameter and updates global size without replacing data or zooming points', async () => {
    const { instance, radius, pointPath } = await chart()
    expect(radius()).toBe(1)
    const before = pointPath()
    instance.setOption({ pointSize: 3.5 })
    await flushNativeUpdates()
    expect(radius()).toBe(1.75)
    expect(pointPath()).not.toBe(before)
    instance.setViewportDomain([0, 0.8], 0)
    await flushNativeUpdates()
    expect(radius()).toBe(1.75)
    instance.setOption({ pointSize: undefined })
    await flushNativeUpdates()
    expect(radius()).toBe(1)
  })

  it('inherits global size, respects series overrides and clears overrides through data replacement', async () => {
    const { instance, radius } = await chart({ pointSize: 6, data: data(4) })
    expect(radius()).toBe(2)
    instance.setOption({ pointSize: 8 })
    await flushNativeUpdates()
    expect(radius()).toBe(2)
    instance.setOption({ data: data() })
    await flushNativeUpdates()
    expect(radius()).toBe(4)
  })

  it.each([0, -1, NaN, Infinity, '4', null])(
    'rejects invalid global size %s atomically',
    async (value) => {
      const { instance, radius } = await chart()
      expect(() => instance.setOption({ pointSize: value as number })).toThrow(
        expect.objectContaining({ code: 'invalid-option', field: 'pointSize' }),
      )
      await flushNativeUpdates()
      expect(radius()).toBe(1)
      expect(() => init(document.createElement('div'), { pointSize: value as number })).toThrow()
    },
  )

  it.each([0, -1, NaN, Infinity, '4', null])(
    'inherits global size for invalid series size %s',
    async (value) => {
      const { radius } = await chart({ pointSize: 5, data: data(value as number) })
      expect(radius()).toBe(2.5)
    },
  )

  it.each([
    ['circle', symbolCircle],
    ['square', symbolSquare],
    ['triangle', symbolTriangle],
    ['diamond', symbolDiamond],
  ] as const)(
    'uses equal-area %s symbols for points, point-lines and legends',
    async (shape, type) => {
      const { host, instance, pointPath } = await chart({
        pointSize: 4,
        data: data(undefined, shape, false),
      })
      const expectedLegend = symbol()
        .type(type)
        .size(4 * Math.PI)()!
      const legend = () => host.querySelector('.waveform-legend__point')?.getAttribute('d')
      expect(legend()).toBe(expectedLegend)
      expect(pointPath()).not.toBe('')
      expect(host.querySelector('.waveform-chart__line')!.getAttribute('display')).toBe('none')
      const before = pointPath()
      instance.setOption({ data: data(undefined, shape) })
      await flushNativeUpdates()
      expect(pointPath()).toBe(before)
      expect(host.querySelector('.waveform-chart__line')!.getAttribute('display')).toBeNull()
      instance.setOption({ pointSize: 2 })
      await flushNativeUpdates()
      expect(pointPath()).not.toBe(before)
      expect(legend()).toBe(symbol().type(type).size(Math.PI)())
    },
  )

  it('exports the current point size and legend in SVG', async () => {
    const { host, instance } = await chart({ pointSize: 5 })
    const blob = await instance.exportImage({ format: 'svg' })
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(blob)
    })
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml')
    expect(svg.querySelector('.waveform-chart__point')!.getAttribute('d')).toBe(
      host.querySelector('.waveform-chart__point')!.getAttribute('d'),
    )
    expect(svg.querySelector('.waveform-chart__point')!.getAttribute('d')).toContain('A2.5,2.5')
  })

  it('refreshes point size while entrance animation is enabled', async () => {
    const { instance, radius } = await chart({
      animationEnabled: true,
      animation: { duration: 10_000 },
    })
    instance.setOption({ pointSize: 6 })
    await flushNativeUpdates()
    expect(radius()).toBe(3)
  })
})

import { expect, it } from 'vitest'
import { prepareWaveformSeries } from '@/components/core/useWaveformData'
import { selectSeriesRenderSourcePoints, resolveWaveformRenderingOptions } from '@/core/rendering'

it('selects equivalent geometry directly from compact sources without duplicating endpoint indexes', () => {
  const points = Array.from({ length: 100 }, (_, x) => ({ x, y: Math.sin(x) }))
  const object = prepareWaveformSeries({ kind: 'points', points })[0]!.source
  const compact = prepareWaveformSeries({
    kind: 'typed-points',
    x: Float64Array.from(points, (p) => p.x),
    y: Float64Array.from(points, (p) => p.y),
  })[0]!.source
  const rendering = resolveWaveformRenderingOptions({
    downsampleThreshold: 1,
    maxPointsPerPixel: 1,
  })
  const selection = {
    lineVisible: true,
    pointVisible: true,
    errorBarVisible: false,
    hasErrorPoints: false,
  }
  const select = (source: typeof object) =>
    selectSeriesRenderSourcePoints(source, [0, 99], 10, rendering, selection)
  expect(select(compact)).toEqual(select(object))
  const xs = select(compact).linePoints.map((p) => p.x)
  expect(new Set(xs).size).toBe(xs.length)
  expect(
    selectSeriesRenderSourcePoints(compact, [200, 300], 10, rendering, selection).linePoints,
  ).toEqual([])
})

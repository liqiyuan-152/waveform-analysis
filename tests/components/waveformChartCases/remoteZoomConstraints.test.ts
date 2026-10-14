import { scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'
import type { ResolvedWaveformChartProps } from '@/components/core/waveformChartTypes'
import {
  constrainViewportZoom,
  restoreViewportDomain,
} from '@/components/interaction/remoteViewport'
import { transformForDomain } from '@/components/interaction/zoomConstraints'
import { createWaveformPointSource } from '@/core/waveformPointSource'

const boundary: [number, number] = [0, 4]
const props = {
  integerZoom: false,
  timeUnit: 'ms',
  minVisiblePoints: 2,
  maxZoomScale: null,
  panXDomain: boundary,
} as ResolvedWaveformChartProps
const series = (values: number[]) => ({ points: values.map((x) => ({ x, y: x })) })
const loaded = [series([2.046755, 2.046756, 2.046757])]

describe('remote point-aware viewport constraints', () => {
  it('keeps unloaded windows remote rather than expanding back to the cache', () => {
    expect(constrainViewportZoom([3, 3.00001], boundary, [loaded], props)).toEqual([3, 3.00001])
    expect(restoreViewportDomain([3, 3.00001], boundary, [loaded], props)).toEqual([3, 3.00001])
    expect(constrainViewportZoom([3, 3.00001], boundary, [[]], props)).toEqual([3, 3.00001])
  })

  it('does not stretch a sparse response to the entire record', () => {
    const sparse = [series([2.046756])]
    // Without enough loaded samples, the explicit span limit is still honored.
    const limitedProps = { ...props, minZoomSpan: 1e-6 }
    expect(constrainViewportZoom([2.046755, 2.046757], boundary, [sparse], limitedProps)).toEqual([
      2.046755, 2.046757,
    ])
    expect(restoreViewportDomain([2.046755, 2.046757], boundary, [sparse], props)).toEqual([
      2.046755, 2.046757,
    ])
  })

  it('keeps a supporting synchronized track for irregular compact sources', () => {
    const groups = [
      [series([2.046755, 2.0467551, 2.046757])],
      [series([2.0467552, 2.0467562, 2.0467572])],
    ].map((group) =>
      group.map((item) => ({
        ...item,
        source: createWaveformPointSource(
          {
            kind: 'typed-points',
            x: new Float64Array(item.points.map((p) => p.x)),
            y: new Float64Array(item.points.map((p) => p.y)),
          },
          () => [],
        ),
      })),
    )
    const domain = constrainViewportZoom([2.046756, 2.0467563], boundary, groups, props)
    const counts = groups.map(
      (group) => group[0].points.filter((p) => p.x >= domain[0] && p.x <= domain[1]).length,
    )
    expect(counts).toEqual([0, 2])
    expect(domain[1] - domain[0]).toBeCloseTo(1.1e-6, 12)
    expect(domain[1] - domain[0]).toBeLessThan(3e-6)
  })

  it.each([240, 800])(
    'retains endpoint samples after floating point transform round trips (%s)',
    (width) => {
      const domain = constrainViewportZoom(
        [2.046756 - Number.EPSILON * 2, 2.046756 + Number.EPSILON * 2],
        boundary,
        [loaded],
        props,
      )
      const actual = transformForDomain(domain, boundary, width)
        .rescaleX(scaleLinear(boundary, [0, width]))
        .domain()
      expect(loaded[0].points.filter((p) => p.x >= actual[0] && p.x <= actual[1])).toHaveLength(2)
    },
  )
})

import { describe, expect, it } from 'vitest'
import { applyYAxisPadding } from '@/components/core/yAxisPadding'
import {
  resolveYAxisTicks,
  resolveRenderedYAxisSeriesGroups,
  buildYAxisSlots,
  axisTextMetrics,
} from '@/components/core/layout'
import { prepareWaveformSeries } from '@/components/core/useWaveformData'
import type { DisplaySeries, DisplayTrack } from '@/components/core/types'
import type { WaveformAxesOptions } from '@/types'

const series = prepareWaveformSeries({
  kind: 'points',
  points: [
    { x: 0, y: -73 },
    { x: 1, y: 86 },
  ],
}).map((s) => ({ ...s, color: '#000' })) as DisplaySeries[]
const track: DisplayTrack = {
  id: 'a',
  series,
  visibleSeries: series,
  xDomain: [0, 1],
  yDomain: [-73, 86],
}
const group = {
  index: 0,
  side: 'left' as const,
  seriesList: series,
  domain: [-73, 86] as [number, number],
  fixed: false,
}
function resolve(options?: WaveformAxesOptions['y'], viewport?: [number, number]) {
  const padded = applyYAxisPadding(group, viewport, options)
  return resolveYAxisTicks(padded.domain, 5, true, padded.tickBounds)
}

describe('exact padding with nice ticks', () => {
  it.each([
    [undefined, [-100, 100]],
    [{ maximumTickVisible: false }, [-100, 100]],
    [{ upperPaddingRatio: 0.1 }, [-100, 101.9]],
    [{ lowerPaddingRatio: 0.1 }, [-88.9, 100]],
    [{ upperPaddingRatio: 0.1, lowerPaddingRatio: 0.1 }, [-88.9, 101.9]],
    [{ upperPaddingEnabled: true, lowerPaddingEnabled: true }, [-88.9, 101.9]],
    [{ upperPaddingRatio: 0, lowerPaddingRatio: 0 }, [-73, 86]],
    [{ upperPaddingEnabled: false, upperPaddingRatio: 0.5 }, [-100, 86]],
    [{ lowerPaddingEnabled: false, lowerPaddingRatio: 0.5 }, [-73, 100]],
  ] as const)('preserves configured sides for %o', (options, domain) => {
    const result = resolve(options)
    expect(result.domain).toEqual(domain)
    expect(result.values.every((value) => value >= domain[0] && value <= domain[1])).toBe(true)
    expect(result.values).toEqual(
      [-100, -50, 0, 50, 100].filter((value) => value >= domain[0] && value <= domain[1]),
    )
  })
  it.each([-1, NaN, Infinity])('treats invalid explicit ratios as zero: %s', (ratio) => {
    expect(resolve({ upperPaddingRatio: ratio, lowerPaddingRatio: ratio }).domain).toEqual([
      -73, 86,
    ])
  })
  it('keeps manual bounds without adding padding and fixed ranges keep legacy nice', () => {
    expect(resolve({ upperPaddingRatio: 0.1 }, [-12, 34]).domain).toEqual([-12, 34])
    const fixed = applyYAxisPadding({ ...group, fixed: true }, undefined, {
      upperPaddingRatio: 0.1,
    })
    expect(resolveYAxisTicks(fixed.domain, 5, true, fixed.tickBounds).domain).toEqual([-100, 100])
  })
  it.each([
    [{ lower: -60 }, [-60, 101.9]],
    [{ upper: 70 }, [-88.9, 70]],
    [{ lower: -60, upper: 70 }, [-60, 70]],
    [{ lower: 200 }, [200, 359]],
  ] as const)(
    'gives amplitude bounds priority and preserves the remaining padding for %o',
    (limit, domain) => {
      const resolved = resolveRenderedYAxisSeriesGroups(
        track,
        'single-axis',
        undefined,
        undefined,
        undefined,
        { upperPaddingRatio: 0.1, lowerPaddingRatio: 0.1 },
        { [series[0]!.id]: limit },
      )[0]!
      expect(resolveYAxisTicks(resolved.domain, 5, true, resolved.tickBounds).domain).toEqual(
        domain,
      )
    },
  )
  it('measures labels using the same bounded nice ticks', () => {
    const padding = { upperPaddingRatio: 0.1, lowerPaddingRatio: 0.1 }
    const rendered = resolveRenderedYAxisSeriesGroups(
      track,
      'single-axis',
      undefined,
      undefined,
      undefined,
      padding,
    )[0]!
    const ticks = resolveYAxisTicks(rendered.domain, 5, true, rendered.tickBounds)
    const measured = axisTextMetrics(
      rendered.domain,
      true,
      undefined,
      undefined,
      5,
      false,
      undefined,
      rendered.maximumTick,
      rendered.minimumTick,
      rendered.tickBounds,
    )
    const direct = axisTextMetrics(ticks.domain, false, [...ticks.values, -73, 86], undefined, 5)
    expect(measured).toEqual(direct)
    const slots = buildYAxisSlots(
      [track],
      'single-axis',
      undefined,
      undefined,
      5,
      true,
      false,
      undefined,
      padding,
    )
    expect(slots.slots[0]!.clearance).toBeGreaterThanOrEqual(measured.tickTextWidth)
  })
})

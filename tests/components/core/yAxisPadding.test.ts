import { describe, expect, it } from 'vitest'
import { applyYAxisPadding, paddingRatio, withMaximumTick } from '@/components/core/yAxisPadding'
import { resolveRenderedYAxisSeriesGroups, buildYAxisSlots } from '@/components/core/layout'
import { prepareWaveformSeries } from '@/components/core/useWaveformData'
import type { DisplaySeries, DisplayTrack } from '@/components/core/types'
import { labelsOverlap, linesOverlap } from '@/components/rendering/yAxisTickVisibility'

const series = prepareWaveformSeries({
  kind: 'points',
  points: [
    { x: 0, y: 20 },
    { x: 1, y: 80 },
  ],
}).map((s) => ({ ...s, color: '#000' })) as DisplaySeries[]
const track: DisplayTrack = {
  id: 'a',
  series,
  visibleSeries: series,
  xDomain: [0, 1],
  yDomain: [20, 80],
}
const group = {
  index: 0,
  side: 'left' as const,
  seriesList: series,
  domain: [20, 80] as [number, number],
  fixed: false,
}

describe('Y padding and maximum tick rules', () => {
  it('resolves independent defaults and explicit disable before ratios', () => {
    expect(paddingRatio()).toBe(0)
    expect(paddingRatio(true)).toBe(0.1)
    expect(paddingRatio(false, 0.2)).toBe(0)
    expect(paddingRatio(undefined, 0.2)).toBe(0.2)
    for (const value of [0, -1, NaN, Infinity]) expect(paddingRatio(true, value)).toBe(0)
  })
  it('uses the same original span, without mutating the group or accumulating', () => {
    const options = { upperPaddingEnabled: true, lowerPaddingEnabled: true }
    for (let i = 0; i < 3; i++) {
      expect(applyYAxisPadding(group, undefined, options)).toMatchObject({
        domain: [14, 86],
        maximumTick: 80,
      })
      expect(group.domain).toEqual([20, 80])
    }
    expect(applyYAxisPadding(group, undefined, 0.1).domain).toEqual([20, 86])
  })
  it('protects fixed and manual viewports and rejects overflow', () => {
    expect(applyYAxisPadding({ ...group, fixed: true }, undefined, 0.1).domain).toEqual([20, 80])
    expect(applyYAxisPadding(group, [30, 40], 0.1).domain).toEqual([30, 40])
    expect(applyYAxisPadding(group, undefined, Number.MAX_VALUE).domain).toEqual([20, 80])
    expect(
      resolveRenderedYAxisSeriesGroups(track, 'single-axis', [0, 10], undefined, undefined, 0.1)[0]
        ?.domain,
    ).toEqual([0, 10])
    expect(
      resolveRenderedYAxisSeriesGroups(
        track,
        'single-axis',
        undefined,
        undefined,
        { a: [30, 40] },
        0.1,
      )[0]?.domain,
    ).toEqual([30, 40])
  })
  it('preserves the raw constant maximum before nonzero fallback', () => {
    for (const y of [0, 5, -5]) {
      const [s] = prepareWaveformSeries({ kind: 'points', points: [{ x: 0, y }] })
      const result = applyYAxisPadding(
        { ...group, domain: s!.yDomain, seriesList: [{ ...s!, color: '#000' }] },
        undefined,
        0.1,
      )
      expect(result.maximumTick).toBe(y)
      expect(result.domain[1]).toBeGreaterThan(y)
    }
    expect(
      applyYAxisPadding({ ...group, seriesList: [] }, undefined, 0.1).maximumTick,
    ).toBeUndefined()
  })
  it('keeps tiny distinct values but merges relative floating point duplicates', () => {
    expect(withMaximumTick([0, 0.3, 1], 0.1 + 0.2)).toHaveLength(3)
    expect(withMaximumTick([1e-20, 2e-20], 1.5e-20)).toHaveLength(3)
    expect(withMaximumTick([0, 1])).toEqual([0, 1])
  })
  it('reserves label slots for padded domains and the maximum', () => {
    const slots = buildYAxisSlots(
      [track],
      'single-axis',
      undefined,
      undefined,
      5,
      false,
      false,
      undefined,
      { upperPaddingEnabled: true },
    )
    expect(slots.slots[0]!.clearance).toBeGreaterThan(0)
  })
  it('separates label and stroke collision thresholds in pixels', () => {
    const box = { left: 0, right: 20, top: 0, bottom: 11 }
    expect(labelsOverlap(box, { ...box, top: 14, bottom: 25 })).toBe(true)
    expect(labelsOverlap(box, { ...box, top: 15, bottom: 26 })).toBe(false)
    expect(labelsOverlap(box, { ...box, left: 30, right: 50 })).toBe(false)
    expect(linesOverlap(1, 2.9)).toBe(true)
    expect(linesOverlap(1, 3)).toBe(false)
  })
})

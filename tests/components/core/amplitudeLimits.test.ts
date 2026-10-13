import { describe, expect, it } from 'vitest'
import { normalizeAmplitudeLimit, applyAmplitudeLimits } from '@/components/core/amplitudeLimits'
import { prepareWaveformSeries } from '@/components/core/useWaveformData'
import {
  axisTextMetrics,
  buildYAxisSlots,
  resolveRenderedYAxisSeriesGroups,
  resolveYAxisTicks,
} from '@/components/core/layout'
import { resolveYAxisLayoutMetrics } from '@/components/core/yAxisLayoutMetrics'
import type { DisplaySeries, DisplayTrack } from '@/components/core/types'
import type { WaveformAmplitudeLimit, WaveformAmplitudeLimits } from '@/index'

function track(): DisplayTrack {
  const series = prepareWaveformSeries({
    kind: 'series',
    series: ['a', 'b'].map((id) => ({
      id,
      name: id,
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 20 },
          { x: 1, y: 80 },
        ],
      },
    })),
  }).map((s) => ({ ...s, color: '#000' })) as DisplaySeries[]
  return { id: 'track', series, visibleSeries: series, xDomain: [0, 1], yDomain: [20, 80] }
}

describe('amplitude limits', () => {
  it.each([
    [undefined, undefined],
    [{}, undefined],
    [{ lower: 0 }, { lower: 0, upper: undefined }],
    [{ upper: 0 }, { lower: undefined, upper: 0 }],
    [{ lower: 5, upper: 5 }, undefined],
    [{ lower: 6, upper: 5 }, undefined],
    [{ lower: NaN, upper: Infinity }, undefined],
    [
      { lower: -Infinity, upper: 3 },
      { lower: undefined, upper: 3 },
    ],
    [
      { lower: -3, upper: NaN },
      { lower: -3, upper: undefined },
    ],
  ] as [WaveformAmplitudeLimit | undefined, WaveformAmplitudeLimit | undefined][])(
    'normalizes %o without changing the input',
    (input, expected) => {
      const before = input && { ...input }
      expect(normalizeAmplitudeLimit(input)).toEqual(expected)
      expect(input).toEqual(before)
    },
  )

  it.each([
    [{ lower: -73, upper: 86 }, [-73, 86]],
    [{ lower: 0 }, [0, 86]],
    [{ upper: 70 }, [14, 70]],
    [{ lower: 100 }, [100, 160]],
    [{ upper: -100 }, [-160, -100]],
    [{ lower: 1000 }, [1000, 1100]],
  ] as [WaveformAmplitudeLimit, number[]][])(
    'fixes only configured sides of %o after padding, ignoring manual viewports',
    (limit, expected) => {
      const group = resolveRenderedYAxisSeriesGroups(
        track(),
        'single-axis',
        [-999, 999],
        undefined,
        { track: [40, 50] },
        { upperPaddingEnabled: true, lowerPaddingEnabled: true },
        { a: limit },
      )[0]!
      expect(group.domain).toEqual(expected)
      expect(group.amplitudeLimit).toEqual(normalizeAmplitudeLimit(limit))
    },
  )

  it('uses a minimum fallback span of one when the automatic side collapses', () => {
    expect(applyAmplitudeLimits([0, 0.1], { lower: 0.1 })).toEqual([0.1, 1.1])
    expect(applyAmplitudeLimits([0, 0.1], { upper: 0 })).toEqual([-1, 0])
  })

  it('keeps both strict bounds with nice internal ticks; only automatic sides expand', () => {
    const both = resolveYAxisTicks([-73, 86], 5, true, { lower: -73, upper: 86 })
    expect(both.domain).toEqual([-73, 86])
    expect(both.values.length).toBeGreaterThan(1)
    expect(both.values.every((v) => v >= -73 && v <= 86 && v % 10 === 0)).toBe(true)
    expect(resolveYAxisTicks([-73, 86], 5, true, { lower: -73 }).domain).toEqual([-73, 100])
    expect(resolveYAxisTicks([-73, 86], 5, true, { upper: 86 }).domain).toEqual([-100, 86])
    expect(resolveYAxisTicks([-73, 86], 5, false, { lower: -73, upper: 86 }).domain).toEqual([
      -73, 86,
    ])
    expect(resolveYAxisTicks([-73, 86]).domain).toEqual([-100, 100])
  })

  it('merges visible series bounds on shared axes and keeps independent axes separate', () => {
    let t = track()
    const limits: WaveformAmplitudeLimits = {
      a: { lower: -73, upper: 86 },
      b: { lower: -100, upper: 200 },
      track: { lower: -9999, upper: 9999 },
    }
    const groups = (mode: 'single-axis' | 'multi-axis') =>
      resolveRenderedYAxisSeriesGroups(t, mode, undefined, undefined, undefined, undefined, limits)
    expect(groups('single-axis').map((g) => g.domain)).toEqual([[-100, 200]])
    expect(groups('multi-axis').map((g) => g.domain)).toEqual([
      [-73, 86],
      [-100, 200],
    ])
    t = { ...t, visibleSeries: [t.series[0]!] }
    expect(groups('single-axis')[0]?.domain).toEqual([-73, 86])
    t = { ...t, visibleSeries: [] }
    expect(groups('single-axis')[0]?.domain).toEqual([-100, 200])
    expect(groups('single-axis')[0]?.maximumTick).toBeUndefined()
  })

  it('merges single-sided limits and excludes invalid configurations', () => {
    const t = track()
    const group = (limits: WaveformAmplitudeLimits) =>
      resolveRenderedYAxisSeriesGroups(
        t,
        'single-axis',
        undefined,
        undefined,
        undefined,
        undefined,
        limits,
      )[0]!
    expect(group({ a: { lower: 0 }, b: { upper: 70 } }).domain).toEqual([0, 70])
    expect(group({ a: { lower: 0 }, b: { lower: 4, upper: 4 } }).domain).toEqual([0, 80])
    expect(group({ a: { lower: 100, upper: 0 } }).amplitudeLimit).toBeUndefined()
  })

  it('measures labels and axis slots with the exact rendered domain and ticks', () => {
    const t = track(),
      limits = { a: { lower: -73, upper: 86 } }
    const domain: [number, number] = [-73, 86]
    const { values } = resolveYAxisTicks(domain, 5, true, limits.a)
    const expected = axisTextMetrics(domain, false, values, undefined, 5, false, undefined, 80, 20)
    const metrics = resolveYAxisLayoutMetrics(
      [t],
      'single-axis',
      undefined,
      undefined,
      {},
      true,
      5,
      false,
      undefined,
      true,
      undefined,
      limits,
    )
    expect(metrics.tickClearance).toBe(expected.tickTextWidth + 11)
    const slots = buildYAxisSlots(
      [t],
      'single-axis',
      undefined,
      undefined,
      5,
      true,
      false,
      {},
      undefined,
      true,
      undefined,
      limits,
    )
    expect(slots.clearance.left).toBe(metrics.fullClearance)
  })

  it('keeps empty track handling and legacy fixed domains when limits are inactive', () => {
    let t = track()
    expect(
      resolveRenderedYAxisSeriesGroups(
        t,
        'single-axis',
        [-73, 86],
        undefined,
        undefined,
        undefined,
        { a: { lower: 10, upper: 0 } },
      )[0]?.domain,
    ).toEqual([-73, 86])
    t = { ...t, series: [], visibleSeries: [] }
    expect(
      resolveRenderedYAxisSeriesGroups(
        t,
        'single-axis',
        undefined,
        undefined,
        undefined,
        undefined,
        { a: { lower: 0 } },
      ),
    ).toEqual([])
  })
})

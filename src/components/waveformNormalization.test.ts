import { describe, expect, it } from 'vitest'
import { prepareWaveformSeries } from './core/useWaveformData'
import { normalizeWaveformData, normalizeWaveformSeries } from './waveform'
describe('normalizeWaveformData', () => {
  it('converts samples into time-based points', () => {
    expect(
      normalizeWaveformData({
        kind: 'samples',
        values: [2, 4, 6],
        sampleRate: 2,
        startTime: 1,
      }),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 1.5, y: 4 },
      { x: 2, y: 6 },
    ])
  })

  it('sorts explicit points and filters non-finite values', () => {
    expect(
      normalizeWaveformData({
        kind: 'points',
        points: [
          { x: 2, y: 4 },
          { x: Number.NaN, y: 3 },
          { x: 1, y: 2 },
        ],
      }),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ])
  })

  it('returns no points for an invalid sample rate', () => {
    expect(normalizeWaveformData({ kind: 'samples', values: [1, 2], sampleRate: 0 })).toEqual([])
  })

  it('keeps large-data error extrema in the prepared Y domain', () => {
    const points = Array.from({ length: 10_001 }, (_, index) => ({
      x: index,
      y: 0,
      ...(index === 5_555 ? { error: 10_000 } : {}),
    }))
    const [series] = prepareWaveformSeries({
      kind: 'series',
      series: [
        {
          name: 'errors',
          errorBar: { visible: true },
          data: { kind: 'points', points },
        },
      ],
    })

    expect(series?.points).toHaveLength(points.length)
    expect(series?.hasErrorPoints).toBe(true)
    expect(series?.yDomain[0]).toBeLessThanOrEqual(-10_000)
    expect(series?.yDomain[1]).toBeGreaterThanOrEqual(10_000)
  })

  it('normalizes errors and preserves a pure error-bar series', () => {
    const [series] = normalizeWaveformSeries({
      kind: 'series',
      series: [
        {
          name: 'styled',
          lineType: 'none',
          pointType: 'none',
          errorBar: { visible: true, width: -1, capWidth: Number.NaN },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 2, error: 1, lowerError: -1, upperError: 2 },
              { x: 1, y: 3, error: Number.NaN },
            ],
          },
        },
      ],
    })

    expect(series).toMatchObject({
      lineType: 'none',
      pointType: 'none',
      errorBar: { visible: true, width: 1.5, capWidth: 8 },
      points: [
        { x: 0, y: 2, error: 1, upperError: 2 },
        { x: 1, y: 3 },
      ],
    })
  })

  it('falls back to a line only when every series visual is disabled', () => {
    const [series] = normalizeWaveformSeries({
      kind: 'series',
      series: [
        {
          name: 'invisible',
          lineType: 'none',
          pointType: 'none',
          errorBar: { visible: false },
          data: { kind: 'points', points: [{ x: 0, y: 1 }] },
        },
      ],
    })

    expect(series).toMatchObject({
      lineType: 'linear',
      pointType: 'none',
      errorBar: { visible: false },
    })
  })

  it('includes visible error bounds in the prepared Y domain', () => {
    const [series] = prepareWaveformSeries({
      kind: 'series',
      series: [
        {
          name: 'errors',
          errorBar: { visible: true },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 2, lowerError: 3, upperError: 4 },
              { x: 1, y: 3 },
            ],
          },
        },
      ],
    })

    expect(series?.yDomain[0]).toBeLessThanOrEqual(-1)
    expect(series?.yDomain[1]).toBeGreaterThanOrEqual(6)
    expect(series?.hasErrorPoints).toBe(true)
  })

  it('normalizes multiple named series and removes empty series', () => {
    expect(
      normalizeWaveformSeries({
        kind: 'series',
        series: [
          {
            trackId: 'comparison-track',
            name: 'BT2_2M',
            unit: 'T',
            data: { kind: 'points', points: [{ x: 1, y: 2 }] },
          },
          {
            name: 'empty',
            data: { kind: 'samples', values: [1], sampleRate: 0 },
          },
        ],
      }),
    ).toEqual([
      {
        id: 'series-0',
        trackId: 'comparison-track',
        name: 'BT2_2M',
        unit: 'T',
        color: undefined,
        lineType: 'linear',
        lineStyle: 'solid',
        pointType: 'none',
        errorBar: { visible: false, width: 1.5, capWidth: 8 },
        points: [{ x: 1, y: 2 }],
      },
    ])
  })
})

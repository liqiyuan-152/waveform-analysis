import { describe, expect, it } from 'vitest'

import type { WaveformPoint } from '../types'
import {
  hasMinimumVisibleXValues,
  resolveWaveformRenderingOptions,
  selectDecorationPoints,
  selectRenderablePoints,
  selectSeriesRenderPoints,
} from './rendering'

describe('waveform rendering selection', () => {
  const points = Array.from({ length: 10_000 }, (_, index): WaveformPoint => ({
    x: index,
    y: index === 5_001 ? 10_000 : Math.sin(index / 20),
  }))

  it('clips to the visible domain and retains one continuity point on each side', () => {
    const selected = selectRenderablePoints(
      points,
      [4_000, 4_100],
      500,
      resolveWaveformRenderingOptions({ downsample: false }),
    )

    expect(selected[0].x).toBe(3_999)
    expect(selected.at(-1)?.x).toBe(4_101)
  })

  it('bounds path density while preserving narrow extrema', () => {
    const selected = selectRenderablePoints(
      points,
      [0, 9_999],
      100,
      resolveWaveformRenderingOptions({ downsampleThreshold: 100, maxPointsPerPixel: 4 }),
    )

    expect(selected.length).toBeLessThanOrEqual(402)
    expect(selected).toContain(points[5_001])
    expect(selected[0]).toBe(points[0])
    expect(selected.at(-1)).toBe(points.at(-1))
  })

  it('normalizes invalid rendering options to stable defaults', () => {
    expect(
      resolveWaveformRenderingOptions({
        downsampleThreshold: -1,
        maxPointsPerPixel: 0,
        pointMinSpacing: -1,
        errorBarMinSpacing: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      downsample: true,
      downsampleThreshold: 2_000,
      maxPointsPerPixel: 4,
      pointMinSpacing: 10,
      errorBarMinSpacing: 12,
    })
  })

  it('accepts custom decoration spacing and uses zero to disable it', () => {
    expect(resolveWaveformRenderingOptions({ pointMinSpacing: 6, errorBarMinSpacing: 0 })).toEqual({
      downsample: true,
      downsampleThreshold: 2_000,
      maxPointsPerPixel: 4,
      pointMinSpacing: 6,
      errorBarMinSpacing: 0,
    })
  })

  it('selects evenly distributed source points for dense decorations', () => {
    const selected = selectDecorationPoints(points, [0, 9_999], 100, 10, true)

    expect(selected.length).toBeLessThanOrEqual(12)
    expect(selected[0]).toBe(points[0])
    expect(selected.at(-1)).toBe(points.at(-1))
    expect(selected.every((point) => points.includes(point))).toBe(true)
  })

  it('clips decorations exactly to the visible domain and preserves sparse points', () => {
    const sparsePoints = [
      { x: 0, y: 0 },
      { x: 40, y: 1 },
      { x: 80, y: 2 },
      { x: 120, y: 3 },
    ]

    expect(selectDecorationPoints(sparsePoints, [40, 80], 100, 10, true)).toEqual([
      sparsePoints[1],
      sparsePoints[2],
    ])
  })

  it('supports filtering decoration candidates and disabling sampling', () => {
    const errorPoints = Array.from({ length: 100 }, (_, index) => ({
      x: index,
      y: index,
      error: index % 10 === 0 ? 1 : 0,
    }))
    const hasError = (point: WaveformPoint) => (point.error ?? 0) > 0

    expect(selectDecorationPoints(errorPoints, [0, 99], 100, 12, true, hasError)).toHaveLength(10)
    expect(selectDecorationPoints(errorPoints, [0, 99], 100, 12, false)).toHaveLength(100)
    expect(selectDecorationPoints(errorPoints, [0, 99], 100, 0, true)).toHaveLength(100)
  })

  it('prefers priority candidates within dense decoration buckets', () => {
    const priorityPoints = Array.from({ length: 100 }, (_, index) => ({
      x: index,
      y: index,
      error: index % 20 === 1 ? 1 : 0,
    }))
    const hasError = (point: WaveformPoint) => (point.error ?? 0) > 0
    const selected = selectDecorationPoints(
      priorityPoints,
      [0, 99],
      100,
      20,
      true,
      undefined,
      hasError,
    )

    expect(selected.filter(hasError)).toEqual(priorityPoints.filter(hasError))
    expect(selected.length).toBeLessThanOrEqual(Math.ceil(100 / 20) + 2)
  })

  it('shares visible-range selection for a dense 100k-point series', () => {
    const densePoints = Array.from({ length: 100_000 }, (_, index): WaveformPoint => ({
      x: index,
      y: index === 50_001 ? 10_000 : Math.sin(index / 20),
      error: index % 1_000 === 0 ? 1 : undefined,
    }))
    const selected = selectSeriesRenderPoints(
      densePoints,
      [99_999, 0],
      500,
      resolveWaveformRenderingOptions({ downsampleThreshold: 100 }),
      {
        lineVisible: true,
        pointVisible: true,
        errorBarVisible: true,
        hasErrorPoints: true,
      },
    )

    expect(selected.linePoints.length).toBeLessThanOrEqual(2_002)
    expect(selected.linePoints).toContain(densePoints[50_001])
    expect(selected.linePoints[0]).toBe(densePoints[0])
    expect(selected.linePoints.at(-1)).toBe(densePoints.at(-1))
    expect(selected.pointRenderPoints.length).toBeLessThanOrEqual(52)
    expect(selected.errorBarRenderPoints.every((point) => (point.error ?? 0) > 0)).toBe(true)
  })

  it('counts unique visible x values across series and reversed domains', () => {
    const first = {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const second = {
      points: [
        { x: 0, y: 2 },
        { x: 1, y: 3 },
        { x: 2, y: 4 },
      ],
    }

    expect(hasMinimumVisibleXValues([first, second], [2, 0], 3)).toBe(true)
    expect(hasMinimumVisibleXValues([first, second], [0, 2], 4)).toBe(false)
    expect(hasMinimumVisibleXValues([first, second], [1, 1], 1)).toBe(true)
    expect(hasMinimumVisibleXValues([first, second], [3, 4], 1)).toBe(false)
  })

  it('stops scanning a 100k-point series after reaching the minimum', () => {
    const source = Array.from({ length: 100_000 }, (_, index) => ({ x: index, y: index }))
    let pointReads = 0
    const points = new Proxy(source, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) pointReads += 1
        return Reflect.get(target, property, receiver)
      },
    })

    expect(hasMinimumVisibleXValues([{ points }], [0, 99_999], 5)).toBe(true)
    expect(pointReads).toBeLessThan(100)
  })
})

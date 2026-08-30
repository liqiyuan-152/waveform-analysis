import { describe, expect, it } from 'vitest'

import type { WaveformPoint, WaveformRenderingOptions } from '../types'
import {
  DEFAULT_WAVEFORM_RENDERING_OPTIONS,
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
    ).toEqual(DEFAULT_WAVEFORM_RENDERING_OPTIONS)
  })

  it('accepts custom decoration spacing and uses zero to disable it', () => {
    expect(resolveWaveformRenderingOptions({ pointMinSpacing: 6, errorBarMinSpacing: 0 })).toEqual({
      ...DEFAULT_WAVEFORM_RENDERING_OPTIONS,
      pointMinSpacing: 6,
      errorBarMinSpacing: 0,
    })
  })

  it('normalizes sampling options with strict runtime validation', () => {
    const options: WaveformRenderingOptions = {
      sampling: {
        mode: 'wasm',
        autoThreshold: 1_001.9,
        autoHysteresis: 20.8,
        strategy: 'minmax',
        maxPointsPerPixel: 2.5,
        rawPointLimit: 50_000.2,
        wasmFailureFallback: 'javascript',
      },
    }

    expect(resolveWaveformRenderingOptions(options)).toMatchObject({
      downsample: true,
      maxPointsPerPixel: 2.5,
      sampling: {
        mode: 'wasm',
        autoThreshold: 1_001,
        autoHysteresis: 20,
        strategy: 'minmax',
        maxPointsPerPixel: 2.5,
        rawPointLimit: 50_000,
        wasmFailureFallback: 'javascript',
      },
    })

    expect(
      resolveWaveformRenderingOptions({
        sampling: {
          mode: 'invalid',
          autoThreshold: 0,
          autoHysteresis: -1,
          strategy: 'invalid',
          maxPointsPerPixel: Number.POSITIVE_INFINITY,
          rawPointLimit: 0,
          wasmFailureFallback: 'fallback',
        },
      } as unknown as WaveformRenderingOptions),
    ).toMatchObject({ sampling: DEFAULT_WAVEFORM_RENDERING_OPTIONS.sampling })
  })

  it('maps legacy downsample flags and gives explicit sampling mode precedence', () => {
    expect(resolveWaveformRenderingOptions({ downsample: false }).sampling.mode).toBe('raw')
    expect(resolveWaveformRenderingOptions({ downsample: true }).sampling.mode).toBe('auto')
    expect(
      resolveWaveformRenderingOptions({ downsample: false, sampling: { mode: 'wasm' } }),
    ).toMatchObject({ downsample: true, sampling: { mode: 'wasm' } })
  })

  it('prefers nested sampling density over the legacy rendering field', () => {
    const legacy = resolveWaveformRenderingOptions({ maxPointsPerPixel: 2 })
    const nested = resolveWaveformRenderingOptions({
      maxPointsPerPixel: 2,
      sampling: { maxPointsPerPixel: 3 },
    })

    expect(legacy.maxPointsPerPixel).toBe(2)
    expect(legacy.sampling.maxPointsPerPixel).toBe(2)
    expect(nested.maxPointsPerPixel).toBe(3)
    expect(nested.sampling.maxPointsPerPixel).toBe(3)
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
      resolveWaveformRenderingOptions({
        downsampleThreshold: 100,
        sampling: { autoThreshold: 200_000 },
      }),
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

  it('uses a width-bounded placeholder while large-series Worker sampling is pending', () => {
    const rendering = resolveWaveformRenderingOptions({
      sampling: { mode: 'auto', autoThreshold: 1_000, maxPointsPerPixel: 2 },
    })
    const selected = selectSeriesRenderPoints(points, [0, 9_999], 100, rendering, {
      lineVisible: true,
      pointVisible: false,
      errorBarVisible: false,
      hasErrorPoints: false,
    })

    expect(selected.linePoints).toHaveLength(200)
    expect(selected.linePoints[0]).toBe(points[0])
    expect(selected.linePoints.at(-1)).toBe(points.at(-1))
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

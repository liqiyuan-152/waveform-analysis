import { describe, expect, it } from 'vitest'

import type { WaveformPoint } from '../types'
import { DEFAULT_WAVEFORM_RENDERING_OPTIONS } from './renderingOptions'
import {
  CompletePointSelectionStrategy,
  PeakPreservingPointSelectionStrategy,
  resolveRenderablePointSelectionStrategy,
} from './renderingStrategies'

const denseOptions = {
  ...DEFAULT_WAVEFORM_RENDERING_OPTIONS,
  downsampleThreshold: 0,
  maxPointsPerPixel: 1,
}

describe('renderable point selection strategies', () => {
  it('resolves complete-point selection at the configured boundaries', () => {
    const complete = resolveRenderablePointSelectionStrategy({
      visibleCount: 100,
      width: 100,
      options: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
    })
    const disabled = resolveRenderablePointSelectionStrategy({
      visibleCount: 10_000,
      width: 100,
      options: { ...denseOptions, downsample: false },
    })

    expect(complete).toBeInstanceOf(CompletePointSelectionStrategy)
    expect(disabled).toBeInstanceOf(CompletePointSelectionStrategy)
  })

  it('resolves peak-preserving selection for dense visible data', () => {
    const strategy = resolveRenderablePointSelectionStrategy({
      visibleCount: 1_000,
      width: 100,
      options: denseOptions,
    })

    expect(strategy).toBeInstanceOf(PeakPreservingPointSelectionStrategy)
    expect(strategy.name).toBe('peak-preserving')
  })

  it('reuses the resolved strategy instance across selections', () => {
    const request = { visibleCount: 100, width: 100, options: DEFAULT_WAVEFORM_RENDERING_OPTIONS }
    const peakRequest = { visibleCount: 1_000, width: 100, options: denseOptions }

    expect(resolveRenderablePointSelectionStrategy(request)).toBe(
      resolveRenderablePointSelectionStrategy(request),
    )
    expect(resolveRenderablePointSelectionStrategy(peakRequest)).toBe(
      resolveRenderablePointSelectionStrategy(peakRequest),
    )
  })

  it('retains first, last, minimum, and maximum points in a peak bucket', () => {
    const points: WaveformPoint[] = [
      { x: 0, y: 5 },
      { x: 1, y: 1 },
      { x: 2, y: 10 },
      { x: 3, y: 3 },
      { x: 4, y: 7 },
    ]
    const strategy = new PeakPreservingPointSelectionStrategy()
    const selected = strategy.select({
      points,
      range: { start: 0, end: points.length },
      domain: [0, 4],
      width: 4,
      options: denseOptions,
    })

    expect(selected[0]).toBe(points[0])
    expect(selected.at(-1)).toBe(points.at(-1))
    expect(selected.map((point) => point.y)).toEqual(expect.arrayContaining([1, 10]))
  })
})

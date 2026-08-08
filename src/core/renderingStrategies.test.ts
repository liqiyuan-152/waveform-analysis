import { describe, expect, it } from 'vitest'

import type { WaveformPoint } from '../types'
import { DEFAULT_WAVEFORM_RENDERING_OPTIONS } from './renderingOptions'
import {
  peakPreservingPointSelectionStrategy,
  resolveRenderablePointSelectionStrategy,
  type RenderablePointSelectionContext,
} from './renderingStrategies'

const denseOptions = {
  ...DEFAULT_WAVEFORM_RENDERING_OPTIONS,
  downsampleThreshold: 0,
  maxPointsPerPixel: 1,
}

describe('renderable point selection strategies', () => {
  it('resolves complete-point selection at the configured boundaries', () => {
    const context: RenderablePointSelectionContext = {
      points: [
        { x: 0, y: 5 },
        { x: 1, y: 1 },
        { x: 2, y: 10 },
        { x: 3, y: 3 },
        { x: 4, y: 7 },
      ],
      range: { start: 0, end: 5 },
      domain: [0, 4],
      width: 100,
      options: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
    }
    const complete = resolveRenderablePointSelectionStrategy({
      visibleCount: 100,
      width: 100,
      options: DEFAULT_WAVEFORM_RENDERING_OPTIONS,
    })(context)
    const disabled = resolveRenderablePointSelectionStrategy({
      visibleCount: 10_000,
      width: 100,
      options: { ...denseOptions, downsample: false },
    })(context)

    expect(complete).toEqual(context.points)
    expect(disabled).toEqual(context.points)
  })

  it('resolves peak-preserving selection for dense visible data', () => {
    const context: RenderablePointSelectionContext = {
      points: [
        { x: 0, y: 5 },
        { x: 1, y: 1 },
        { x: 2, y: 10 },
        { x: 3, y: 3 },
        { x: 4, y: 7 },
      ],
      range: { start: 0, end: 5 },
      domain: [0, 4],
      width: 4,
      options: denseOptions,
    }
    const selected = resolveRenderablePointSelectionStrategy({
      visibleCount: 1_000,
      width: 4,
      options: denseOptions,
    })(context)

    expect(selected).toEqual(expect.arrayContaining([context.points[1], context.points[2]]))
  })

  it('retains first, last, minimum, and maximum points in a peak bucket', () => {
    const points: WaveformPoint[] = [
      { x: 0, y: 5 },
      { x: 1, y: 1 },
      { x: 2, y: 10 },
      { x: 3, y: 3 },
      { x: 4, y: 7 },
    ]
    const selected = peakPreservingPointSelectionStrategy({
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

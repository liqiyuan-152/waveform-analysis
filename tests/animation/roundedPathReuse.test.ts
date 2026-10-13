import { curveStep, line, scaleLinear } from 'd3'
import { describe, expect, it, vi } from 'vitest'
import { createPathBuffer } from '@/components/animation/pathBuffer'
import type { WaveformPoint } from '@/types'

describe('rounded D3 command path reuse', () => {
  it('still evaluates scales when commands round alike and refreshes across a rounding boundary', () => {
    const x = scaleLinear().domain([0, 1]).range([0, 100])
    const y = scaleLinear().domain([0, 1]).range([0, 100])
    const input = [Object.freeze({ x: 0.25, y: 0.25 }), Object.freeze({ x: 0.75, y: 0.75 })]
    const buffer = createPathBuffer(x, y)
    const reference = line<WaveformPoint>()
      .x((point) => x(point.x))
      .y((point) => y(point.y))
    const initial = buffer(input, 'linear', x, y)
    expect(initial).toBe(reference(input))
    y.range([0.0001, 100.0001])
    expect(buffer(input, 'linear', x, y)).toBe(initial)
    y.range([0.0006, 100.0006])
    const updated = buffer(input, 'linear', x, y)
    expect(updated).toBe(reference(input))
    expect(updated).not.toBe(initial)
  })

  it('preserves step midpoints, command changes, single-point closure and empty output', () => {
    const scale = scaleLinear().domain([0, 1]).range([0, 1])
    const points = [
      { x: 0.0001, y: 0.2 },
      { x: 0.001, y: 0.7 },
    ]
    const buffer = createPathBuffer(scale, scale)
    const reference = line<WaveformPoint>()
      .x((point) => scale(point.x))
      .y((point) => scale(point.y))
    expect(buffer(points, 'linear', scale, scale)).toBe(reference(points))
    reference.curve(curveStep)
    expect(buffer(points, 'step-middle', scale, scale)).toBe(reference(points))
    points[0].x = 0
    expect(buffer(points, 'step-middle', scale, scale)).toBe(reference(points))
    points.length = 1
    expect(buffer(points, 'step-middle', scale, scale)).toBe(reference(points))
    points.length = 0
    expect(buffer(points, 'step-middle', scale, scale)).toBe('')
  })

  it('keeps evaluating a custom scale interpolator on every generation', () => {
    const evaluate = vi.fn((a: number, b: number, p: number) => a * (1 - p) + b * p)
    const interpolate = vi.fn((a: number, b: number) => (p: number) => evaluate(a, b, p))
    const scale = scaleLinear().domain([0, 1]).range([0, 100]).interpolate(interpolate)
    const input = [Object.freeze({ x: 0.25, y: 0.75 })]
    const buffer = createPathBuffer(scale, scale)
    const first = buffer(input, 'linear', scale, scale)
    expect(buffer(input, 'linear', scale, scale)).toBe(first)
    expect(evaluate).toHaveBeenCalledTimes(4)
    scale.range([0, 200])
    expect(buffer(input, 'linear', scale, scale)).not.toBe(first)
    expect(interpolate).toHaveBeenCalledTimes(2)
    expect(evaluate).toHaveBeenCalledTimes(6)
  })
})

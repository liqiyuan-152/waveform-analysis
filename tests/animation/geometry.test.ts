import { curveStep, curveStepAfter, curveStepBefore, line, scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'
import { generateWaveformPath, interpolateGeometry } from '@/components/animation/geometry'
import type { WaveformLineType, WaveformPoint } from '@/types'
import { createPathTransitionAnimation } from '@/animation/presets/transitions'
import type { GeometryTransitionFrame } from '@/animation/types'

describe('animation geometry allocation', () => {
  it.each(['linear', 'step-start', 'step-middle', 'step-end', 'step-after'] as WaveformLineType[])(
    'preserves long %s paths and short frames across conversion boundaries',
    (type) => {
      const scale = scaleLinear().domain([0, 1]).range([0, 517])
      const reference = line<WaveformPoint>()
        .x((point) => scale(point.x))
        .y((point) => scale(point.y))
      if (type === 'step-start') reference.curve(curveStepBefore)
      if (type === 'step-middle') reference.curve(curveStep)
      if (type === 'step-end' || type === 'step-after') reference.curve(curveStepAfter)
      const points = Array.from({ length: 10000 }, (_, i) =>
        Object.freeze({ x: i / 10000, y: Math.sin(i * 0.123) }),
      )
      const expected = reference(points)!
      expect(expected.length).toBeGreaterThan(65536)
      expect(generateWaveformPath(points, type, scale, scale)).toBe(expected)
      points.length = 1
      expect(generateWaveformPath(points, type, scale, scale)).toBe(reference(points))
    },
  )

  it('keeps public intermediate frame arrays independent from later frames and endpoints', () => {
    const from = { line: [[0, 10, 0, 0]] }
    const to = { line: [[1, 20, 2, 4]] }
    const frames: GeometryTransitionFrame[] = []
    const config = createPathTransitionAnimation({ from, to, compatible: true }, (frame) => {
      frames.push(frame)
    })
    const timeline = {
      rawProgress: 0.25,
      directedProgress: 0.25,
      iteration: 0,
      terminal: false,
    }
    config.during!(0.25, timeline)
    const first = frames[0]
    if (first.kind !== 'interpolate') throw new Error('Expected an intermediate frame')
    ;(first.values.line as number[][])[0][1] = 999
    config.during!(0.75, { ...timeline, rawProgress: 0.75, directedProgress: 0.75 })
    const second = frames[1]
    if (second.kind !== 'interpolate') throw new Error('Expected an intermediate frame')
    expect(second.values.line).toEqual([[0.75, 17.5, 1.5, 3]])
    expect(from.line).toEqual([[0, 10, 0, 0]])
    expect(to.line).toEqual([[1, 20, 2, 4]])
  })

  it('reuses private rows without changing prototype-named channels or endpoint arrays', () => {
    const from = Object.fromEntries([['__proto__', [[0, 10]]]])
    const to = Object.fromEntries([['__proto__', [[4, 20]]]])
    const first = interpolateGeometry(from, to, 0.25)
    const row = (first.__proto__ as number[][])[0]
    expect(row).toEqual([1, 12.5])
    const next = interpolateGeometry(from, to, 0.75)
    expect(next).toBe(first)
    expect((next.__proto__ as number[][])[0]).toBe(row)
    expect(row).toEqual([3, 17.5])
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype)
    expect(Object.hasOwn(next, '__proto__')).toBe(true)
    expect(from.__proto__).toEqual([[0, 10]])
    expect(to.__proto__).toEqual([[4, 20]])
  })

  it.each(['linear', 'step-start', 'step-middle', 'step-end', 'step-after'] as WaveformLineType[])(
    'matches D3 %s projection for irregular X, extreme values and changing scales',
    (type) => {
      const points = [
        { x: -1e308, y: 1e308 },
        { x: -0.0005, y: -0.0005 },
        { x: 0, y: -0 },
        { x: 0.0005, y: 0.0005 },
        { x: 0.7, y: -0.123456 },
        { x: 1e308, y: -1e308 },
      ]
      const x = scaleLinear().domain([0, 1]).range([0, 1])
      const y = scaleLinear().domain([0, 1]).range([0, 1])
      const reference = line<WaveformPoint>()
        .x((p) => x(p.x))
        .y((p) => y(p.y))
      if (type === 'step-start') reference.curve(curveStepBefore)
      if (type === 'step-middle') reference.curve(curveStep)
      if (type === 'step-end' || type === 'step-after') reference.curve(curveStepAfter)
      for (const range of [
        [0, 1],
        [1, 0],
        [0, Infinity],
        [0, 517],
      ]) {
        x.range(range)
        y.range(range)
        expect(generateWaveformPath(points, type, x, y)).toBe(reference(points))
      }
      points.splice(0, points.length, { x: 0.11, y: 0.654321 }, { x: 0.91, y: -0.17 })
      expect(generateWaveformPath(points, type, x, y)).toBe(reference(points))
      points[0].x = 0.123456
      points[0].y = -0.0005
      expect(generateWaveformPath(points, type, x, y)).toBe(reference(points))
    },
  )
  it.each(['linear', 'step-start', 'step-middle', 'step-end', 'step-after'] as WaveformLineType[])(
    'resets the retained %s curve across empty, short and long frames',
    (type) => {
      const scale = scaleLinear().domain([-1, 1]).range([0, 300])
      const reference = line<WaveformPoint>()
        .x((p) => scale(p.x))
        .y((p) => scale(p.y))
      if (type === 'step-start') reference.curve(curveStepBefore)
      if (type === 'step-middle') reference.curve(curveStep)
      if (type === 'step-end' || type === 'step-after') reference.curve(curveStepAfter)
      const points: WaveformPoint[] = []
      for (const count of [0, 1, 2, 1024, 1, 0, 2]) {
        points.splice(
          0,
          points.length,
          ...Array.from({ length: count }, (_, i) =>
            Object.freeze({ x: i / 1024, y: Math.sin(i) }),
          ),
        )
        const snapshot = [...points]
        expect(generateWaveformPath(points, type, scale, scale)).toBe(reference(points))
        expect(points).toEqual(snapshot)
      }
    },
  )
  it('uses current scales and curve settings across repeated renders of the same points', () => {
    const points = [
      { x: 0, y: 1 },
      { x: 1, y: -1 },
    ]
    points.forEach(Object.freeze)
    Object.freeze(points)
    for (const type of [
      'step-start',
      'linear',
      'step-middle',
      'step-end',
      'step-after',
      'linear',
    ] as WaveformLineType[]) {
      const x = scaleLinear()
        .domain([0, 1])
        .range([0, type.length * 10])
      const y = scaleLinear().domain([-1, 1]).range([90, 0])
      const reference = line<WaveformPoint>()
        .x((p) => x(p.x))
        .y((p) => y(p.y))
      if (type === 'step-start') reference.curve(curveStepBefore)
      if (type === 'step-middle') reference.curve(curveStep)
      if (type === 'step-end' || type === 'step-after') reference.curve(curveStepAfter)
      for (let frame = 0; frame < 3; frame++) {
        y.domain([-1 - frame, 1 + frame])
        expect(generateWaveformPath(points, type, x, y)).toBe(reference(points))
      }
    }
  })
  it('matches D3 rounding and extreme values when growing and reusing the path buffer', () => {
    const scale = scaleLinear().domain([0, 1]).range([0, 1])
    const reference = line<WaveformPoint>()
      .x((p) => scale(p.x))
      .y((p) => scale(p.y))
    const values = [
      0,
      -0,
      0.0005,
      -0.0005,
      0.001,
      0.01,
      0.1,
      0.101,
      0.11,
      1e6,
      -1e6,
      1e12,
      -1e12,
      1e308,
      -1e308,
      ...Array.from({ length: 10000 }, (_, i) => Math.sin(i * 0.123) * 999999.999),
    ]
    const points = values.map((value) => Object.freeze({ x: value, y: -value }))
    expect(generateWaveformPath(points, 'linear', scale, scale)).toBe(reference(points))
    // A shorter subsequent render must not expose the old buffer tail.
    points.length = 1
    expect(generateWaveformPath(points, 'linear', scale, scale)).toBe(reference(points))
  })
  it('rejects overflowing intermediate geometry and still accepts its finite endpoint', () => {
    const from = { line: [[0, -1e308, 0, 0]], points: [], errors: [] }
    const to = { line: [[0, 1e308, 0, 0]], points: [], errors: [] }
    expect(() => interpolateGeometry(from, to, 1.5)).toThrow(RangeError)
    expect(interpolateGeometry(from, to, 1).line).toEqual([[0, 1e308, 0, 0]])
  })
  it.each(['linear', 'step-start', 'step-middle', 'step-end', 'step-after'] as WaveformLineType[])(
    'retains D3 %s path semantics, precision and single-point closure',
    (type) => {
      const x = scaleLinear().domain([-1, 1]).range([0, 517])
      const y = scaleLinear().domain([-2, 2]).range([253, 0])
      const reference = line<WaveformPoint>()
        .x((p) => x(p.x))
        .y((p) => y(p.y))
      if (type === 'step-start') reference.curve(curveStepBefore)
      if (type === 'step-middle') reference.curve(curveStep)
      if (type === 'step-end' || type === 'step-after') reference.curve(curveStepAfter)
      for (const points of [
        [],
        [{ x: -0.123456, y: 0.654321 }],
        [
          { x: -0.123456, y: 0.654321 },
          { x: 0.9, y: -1.1 },
        ],
      ]) {
        points.forEach(Object.freeze)
        Object.freeze(points)
        expect(generateWaveformPath(points, type, x, y)).toBe(reference(points))
      }
    },
  )
  it('keeps captured numeric endpoints unchanged when a compatible update is replaced', () => {
    const from = { line: [[0, 0, 1, 2]], points: [], errors: [] }
    const to = { line: [[0, 10, 3, 4]], points: [], errors: [] }
    from.line.forEach(Object.freeze)
    to.line.forEach(Object.freeze)
    const middle = interpolateGeometry(from, to, 0.5)
    expect(middle.line).toEqual([[0, 5, 2, 3]])
    const next = { line: [[0, 20, 5, 6]], points: [], errors: [] }
    const replacement = interpolateGeometry(middle, next, 0.5)
    expect(replacement.line).toEqual([[0, 12.5, 3.5, 4.5]])
    interpolateGeometry(middle, next, 1)
    expect(middle.line).toEqual([[0, 5, 2, 3]])
    expect(from.line).toEqual([[0, 0, 1, 2]])
    expect(to.line).toEqual([[0, 10, 3, 4]])
  })
})

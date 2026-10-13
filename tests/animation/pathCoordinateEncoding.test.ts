import { curveStep, curveStepAfter, curveStepBefore, line, scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'
import { generateWaveformPath } from '@/components/animation/geometry'
import type { WaveformLineType, WaveformPoint } from '@/types'

describe('path coordinate decimal encoding', () => {
  it.each(['linear', 'step-start', 'step-middle', 'step-end', 'step-after'] as WaveformLineType[])(
    'matches D3 %s rounding at signed fractions, carry and fallback boundaries',
    (type) => {
      const values = [
        -0, 0, -0.0005, -0.0005000000000001, 0.0004999999999999, 0.0005, -0.9995, 0.9995,
        -999999.9995, 999999.9995, -1000000.001, 1000000.001, 1e-10, -1e-10, 1e21, -1e21,
      ]
      for (let i = -2000; i <= 2000; i++) {
        values.push(i / 1000, i / 1000 + 0.0005, i / 1000 - 0.0005)
      }
      let seed = 12345
      for (let i = 0; i < 10000; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        values.push((seed / 0xffffffff - 0.5) * 2000000)
      }
      const points = values.map((value, i) => Object.freeze({ x: value, y: values.at(-i - 1)! }))
      const scale = scaleLinear().domain([-1, 1]).range([-1, 1])
      const reference = line<WaveformPoint>()
        .x((point) => scale(point.x))
        .y((point) => scale(point.y))
      if (type === 'step-start') reference.curve(curveStepBefore)
      if (type === 'step-middle') reference.curve(curveStep)
      if (type === 'step-end' || type === 'step-after') reference.curve(curveStepAfter)
      expect(generateWaveformPath(points, type, scale, scale)).toBe(reference(points))
      points.length = 1
      expect(generateWaveformPath(points, type, scale, scale)).toBe(reference(points))
    },
  )
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { MultiResolutionSamplingIndex } from '@/core/workerSampling/multiresolution'
import { sampleWaveformReferenceValues } from '@/core/samplingReferenceValues'

function sampleWaveformReference({
  points,
  strategy,
  targetPointCount,
}: {
  points: Array<{ x: number; y: number }>
  strategy: 'minmax' | 'sum'
  targetPointCount: number
}) {
  return sampleWaveformReferenceValues(
    Float64Array.from(points, (p) => p.x),
    Float64Array.from(points, (p) => p.y),
    strategy,
    targetPointCount,
  )
}

const points = Array.from({ length: 16 }, (_, x) => ({ x, y: x % 3 }))
const cases = [
  { strategy: 'minmax' as const, target: 6, bytes: 64 },
  { strategy: 'sum' as const, target: 4, bytes: 160 },
]
afterEach(() => vi.unstubAllGlobals())

function observeLayers(failAt = Infinity) {
  let allocations = 0
  for (const [name, Original] of Object.entries({ Uint32Array, Float64Array })) {
    vi.stubGlobal(
      name,
      new Proxy(Original, {
        construct(target, args) {
          // Output arrays have target length; the first index layer has length 8.
          if (args[0] === 8 && ++allocations === failAt) throw new RangeError('allocation failed')
          return Reflect.construct(target, args)
        },
      }),
    )
  }
  return () => allocations
}

describe('sampling index allocation budget', () => {
  for (const { strategy, target, bytes } of cases) {
    it.each([0, bytes - 1])(
      `${strategy} rejects layers before allocating at budget %i`,
      (maxBytes) => {
        const allocations = observeLayers()
        const index = new MultiResolutionSamplingIndex(points, { maxBytes })
        for (let attempt = 0; attempt < 3; attempt++) {
          const sampled = index.sample(0, 8, strategy, target)
          expect(sampled).toBeUndefined()
        }
        expect(allocations()).toBe(0)
        expect(index.byteLength).toBe(0)
      },
    )

    it(`${strategy} admits an exactly fitting layer and reuses it`, () => {
      const expected = sampleWaveformReference({
        points: points.slice(0, 8),
        strategy,
        targetPointCount: target,
      })
      const allocations = observeLayers()
      const index = new MultiResolutionSamplingIndex(points, { maxBytes: bytes })
      expect(index.sample(0, 8, strategy, target)).toEqual(expected)
      const first = allocations()
      expect(first).toBe(strategy === 'sum' ? 3 : 2)
      expect(index.byteLength).toBe(bytes)
      expect(index.sample(0, 8, strategy, target)).toEqual(expected)
      expect(allocations()).toBe(first)
      index.dispose()
      expect(index.byteLength).toBe(0)
    })

    it(`${strategy} keeps accounting sound after a partial allocation fails`, () => {
      const allocations = observeLayers(2)
      const index = new MultiResolutionSamplingIndex(points, { maxBytes: bytes })
      expect(index.sample(0, 8, strategy, target)).toBeUndefined()
      expect(index.byteLength).toBe(0)
      expect(index.sample(0, 8, strategy, target)).toBeUndefined()
      expect(allocations()).toBe(2)
      index.dispose()
      expect(index.byteLength).toBe(0)
    })
  }
})

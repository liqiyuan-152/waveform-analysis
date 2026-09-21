import { describe, expect, it } from 'vitest'

import {
  samplingSizeOptions,
  showsSamplingSize,
  usesFixedPointCount,
} from './wasmSamplingDemoSampling'

describe('WASM sampling demo sizing', () => {
  it('uses pixel density for peak-oriented and extrema strategies', () => {
    expect(samplingSizeOptions('auto', 3, 1_000)).toEqual({ maxPointsPerPixel: 3 })
    expect(samplingSizeOptions('peak', 3, 1_000)).toEqual({ maxPointsPerPixel: 3 })
    expect(samplingSizeOptions('minmax', 3, 1_000)).toEqual({ maxPointsPerPixel: 3 })
  })

  it('uses a fixed point count for LTTB and aggregate strategies', () => {
    for (const strategy of ['lttb', 'average', 'sum'] as const) {
      expect(usesFixedPointCount(strategy)).toBe(true)
      expect(samplingSizeOptions(strategy, 3, 1_000)).toEqual({ maxPointCount: 1_000 })
    }
  })

  it('does not show a sampling-size control or pass a size for none', () => {
    expect(showsSamplingSize('none')).toBe(false)
    expect(samplingSizeOptions('none', 3, 1_000)).toEqual({})
  })
})

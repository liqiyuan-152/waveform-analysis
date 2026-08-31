import { describe, expect, it } from 'vitest'

import { resolveAutoSelectedMode } from './latestTaskScheduler'

describe('resolveAutoSelectedMode', () => {
  it('uses the exact threshold when no interaction selection is supplied', () => {
    expect(resolveAutoSelectedMode(1_000, 1_000, 200)).toBe('raw')
    expect(resolveAutoSelectedMode(1_001, 1_000, 200)).toBe('sampled')
  })

  it('keeps the previous mode inside the configured interaction hysteresis band', () => {
    expect(resolveAutoSelectedMode(1_100, 1_000, 200, 'raw')).toBe('raw')
    expect(resolveAutoSelectedMode(1_201, 1_000, 200, 'raw')).toBe('sampled')
    expect(resolveAutoSelectedMode(900, 1_000, 200, 'sampled')).toBe('sampled')
    expect(resolveAutoSelectedMode(800, 1_000, 200, 'sampled')).toBe('raw')
  })
})

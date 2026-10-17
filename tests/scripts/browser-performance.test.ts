import { describe, expect, it } from 'vitest'
import { evaluateHoverTiming } from '../../scripts/browser-performance.mjs'

describe('locked hover budgets', () => {
  const budget = { medianMs: 4, p95Ms: 8 }
  it('rejects sustained median and tail regressions independently', () => {
    expect(evaluateHoverTiming({ samples: Array(20).fill(5) }, budget)).toContain('exceeded')
    expect(evaluateHoverTiming({ samples: [...Array(18).fill(1), 9, 9] }, budget)).toContain(
      'exceeded',
    )
    expect(evaluateHoverTiming({ samples: [...Array(19).fill(1), 9] }, budget)).toBeUndefined()
  })
  it('rejects missing/non-finite samples rather than passing an empty run', () => {
    expect(() => evaluateHoverTiming({ samples: [] }, budget)).toThrow('measurements')
    expect(() => evaluateHoverTiming({ samples: Array(20).fill(NaN) }, budget)).toThrow(
      'measurements',
    )
  })
})

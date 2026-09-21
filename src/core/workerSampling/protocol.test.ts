import { describe, expect, it } from 'vitest'

import { isCurrentWorkerSamplingResponse } from './protocol'

describe('worker sampling response validation', () => {
  it('rejects old request ids and outdated per-series revisions before UI state is committed', () => {
    const current = { requestId: 12, revisions: { alpha: 2, beta: 1 } }
    const response = {
      type: 'sample-viewport-response' as const,
      requestId: 12,
      results: [
        { datasetId: 'alpha', revision: 2 },
        { datasetId: 'beta', revision: 0 },
      ],
    }

    expect(isCurrentWorkerSamplingResponse({ ...response, requestId: 11 } as never, current)).toBe(
      false,
    )
    expect(isCurrentWorkerSamplingResponse(response as never, current)).toBe(false)
    expect(
      isCurrentWorkerSamplingResponse(
        {
          ...response,
          results: [
            { datasetId: 'alpha', revision: 2 },
            { datasetId: 'beta', revision: 1 },
          ],
        } as never,
        current,
      ),
    ).toBe(true)
  })
})

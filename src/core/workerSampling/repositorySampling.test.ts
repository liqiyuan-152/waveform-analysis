import { describe, expect, it } from 'vitest'

import type { WaveformPoint } from '@/types'
import type { WorkerSamplingSeriesRequest } from './protocol'
import { WorkerSamplingRepository } from './repository'

const points: WaveformPoint[] = Array.from({ length: 12 }, (_, index) => ({
  x: index,
  y: index === 5 ? 100 : index,
}))

function register(repository: WorkerSamplingRepository, datasetId: string) {
  return repository.handle({
    type: 'register-dataset',
    requestId: 1,
    datasetId,
    revision: 0,
    points,
  })
}

function sampleSeries(datasetId: string): WorkerSamplingSeriesRequest {
  return {
    seriesId: `${datasetId}-series`,
    datasetId,
    revision: 1,
    xDomain: [0, 11],
    plotWidth: 1_000,
    mode: 'auto',
    autoThreshold: 2,
    strategy: 'peak',
    maxPointsPerPixel: 4,
    maxPointCount: 4,
    rawPointLimit: 5,
  }
}

describe('WorkerSamplingRepository sampling targets', () => {
  it('uses a fixed maximum point count instead of pixel density when configured', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'fixed-target')
    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 51,
      series: [sampleSeries('fixed-target')],
    })

    expect(response.type).toBe('sample-viewport-response')
    if (response.type !== 'sample-viewport-response') return
    expect(response.results[0]?.diagnostics.renderedPointCount).toBeLessThanOrEqual(4)
  })

  it.each(['lttb', 'average', 'sum'] as const)(
    'returns exactly the fixed target for %s when enough points are visible',
    (strategy) => {
      const source = Array.from({ length: 100_000 }, (_, index) => ({
        x: index,
        y: Math.sin(index / 10),
      }))
      const repository = new WorkerSamplingRepository()
      repository.handle({
        type: 'register-dataset',
        requestId: 1,
        datasetId: strategy,
        revision: 0,
        points: source,
      })
      const response = repository.handle({
        type: 'sample-viewport',
        requestId: 2,
        series: [
          {
            ...sampleSeries(strategy),
            xDomain: [0, 99_999],
            strategy,
            maxPointCount: 1_000,
          },
        ],
      })

      expect(response).toMatchObject({
        results: [{ diagnostics: { visiblePointCount: 100_000, renderedPointCount: 1_000 } }],
      })
    },
  )

  it('does not add points when the visible source has fewer than the fixed target', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'small-target')
    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 3,
      series: [
        {
          ...sampleSeries('small-target'),
          strategy: 'lttb',
          maxPointCount: 100,
        },
      ],
    })

    expect(response).toMatchObject({
      results: [{ diagnostics: { visiblePointCount: 12, renderedPointCount: 12 } }],
    })
  })
})

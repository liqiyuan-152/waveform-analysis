import { describe, expect, it } from 'vitest'
import { WorkerSamplingRepository } from '@/core/workerSampling/repository'
import type { WorkerSamplingSeriesRequest } from '@/core/workerSampling/protocol'

function sample(points: { x: number; y: number }[], options: Partial<WorkerSamplingSeriesRequest>) {
  const repository = new WorkerSamplingRepository()
  repository.handle({ type: 'register-dataset', requestId: 1, datasetId: 'd', revision: 0, points })
  const result = repository.handle({
    type: 'sample-viewport',
    requestId: 2,
    series: [
      {
        datasetId: 'd',
        seriesId: 's',
        revision: 1,
        xDomain: [2, 8],
        plotWidth: 100,
        mode: 'auto',
        strategy: 'peak',
        autoThreshold: 1,
        ...options,
      },
    ],
  })
  if (result.type !== 'sample-viewport-response') throw new Error('unexpected response')
  return result.results[0]!
}
describe('viewport line boundaries', () => {
  it.each(['raw', 'auto'] as const)(
    'retains crossing segments in %s with no visible samples',
    (mode) => {
      const result = sample(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        { mode },
      )
      expect(result.output).toEqual({
        kind: 'source-indexes',
        sourceIndexes: new Uint32Array([0, 1]),
      })
      expect(result.diagnostics).toMatchObject({ visiblePointCount: 0, renderedPointCount: 2 })
    },
  )
  it.each(['average', 'sum'] as const)('keeps outside values out of %s buckets', (strategy) => {
    const result = sample(
      [1000, 2, 4, 1000].map((y, x) => ({ x, y })),
      {
        xDomain: [0.5, 2.5],
        strategy,
        maxPointCount: 1,
      },
    )
    expect(result.output).toEqual({
      kind: 'aggregates',
      x: new Float64Array([0, 1.5, 3]),
      y: new Float64Array([1000, strategy === 'sum' ? 6 : 3, 1000]),
    })
    expect(result.diagnostics).toMatchObject({ visiblePointCount: 2, renderedPointCount: 3 })
  })
  it('does not draw a segment outside the source domain', () => {
    expect(
      sample(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        { mode: 'raw' },
      ).output,
    ).toEqual({ kind: 'source-indexes', sourceIndexes: new Uint32Array() })
  })
})

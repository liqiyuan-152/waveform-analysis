import { describe, expect, it } from 'vitest'
import { WorkerSamplingRepository } from '@/core/workerSampling/repository'
import { createStoredDataset } from '@/core/workerSampling/repositoryDataset'
import type { WorkerSamplingDataset } from '@/core/waveformPointSource'
import type { WorkerSamplingSeriesRequest } from '@/core/workerSampling/protocol'

const series = (
  strategy: WorkerSamplingSeriesRequest['strategy'],
  domain: [number, number] = [0, 63],
): WorkerSamplingSeriesRequest => ({
  datasetId: 'd',
  seriesId: 's',
  revision: 1,
  mode: 'auto',
  autoThreshold: 0,
  xDomain: domain,
  plotWidth: 10,
  maxPointCount: 10,
  strategy,
})
function repository(dataset: WorkerSamplingDataset, budget = 8 * 1024 * 1024) {
  const value = new WorkerSamplingRepository({ indexMaxBytes: budget, cacheMaxEntries: 0 })
  value.handle({ type: 'register-dataset', datasetId: 'd', requestId: 1, revision: 0, dataset })
  return value
}
function sample(value: WorkerSamplingRepository, request: WorkerSamplingSeriesRequest) {
  const response = value.handle({ type: 'sample-viewport', requestId: 2, series: [request] })
  if (response.type !== 'sample-viewport-response') throw new Error('Unexpected response')
  return response.results[0]!.output
}
const y = Float64Array.from({ length: 64 }, (_, i) => i % 7)
const inputs: WorkerSamplingDataset[] = [
  { kind: 'typed', x: Float64Array.from(y, (_, i) => i), y },
  { kind: 'samples', values: y, sampleRate: 1, startTime: 0 },
  {
    kind: 'typed',
    x: Float64Array.from(y, (_, i) => Math.floor((63 - i) / 2)),
    y: Float64Array.from(y, (v, i) => (i === 3 ? NaN : v)),
  },
  {
    kind: 'samples',
    values: Float64Array.from(y, (v, i) => (i === 3 ? Infinity : v)),
    sampleRate: 1,
    startTime: 0,
    sourceIndexes: Uint32Array.from(y, (_, i) => (63 - i) * 2),
  },
]

describe('compact JavaScript sampling indexes', () => {
  it.each(inputs)(
    'reuses numeric extrema without changing normalized viewport results: $kind',
    (input) => {
      const indexed = repository(input)
      const reference = repository(input, 0)
      for (const strategy of [
        'peak',
        'min',
        'max',
        'minmax',
        'none',
        'lttb',
        'sum',
        'average',
      ] as const) {
        for (const domain of [
          [0, 63],
          [3.5, 29.5],
          [4, 4],
          [-5, -1],
        ] as [number, number][]) {
          expect(sample(indexed, series(strategy, domain))).toEqual(
            sample(reference, series(strategy, domain)),
          )
        }
      }
      expect(indexed.resourceMetrics.indexBytes).toBeGreaterThan(0)
      expect(reference.resourceMetrics.indexBytes).toBe(0)
      const dataset = createStoredDataset(undefined, input, 1, undefined)
      expect(dataset.points).toBeUndefined()
      if (input.kind === 'samples') expect(dataset.x).toBeUndefined()
      indexed.handle({
        type: 'replace-dataset',
        datasetId: 'd',
        requestId: 3,
        revision: 1,
        dataset: { kind: 'samples', values: new Float64Array([9, 8]), sampleRate: 1, startTime: 0 },
      })
      expect(indexed.resourceMetrics.indexBytes).toBe(0)
      expect(sample(indexed, series('minmax'))).toBeUndefined()
      indexed.handle({ type: 'dispose-all', requestId: 4 })
      expect(indexed.resourceMetrics).toMatchObject({
        datasetCount: 0,
        indexBytes: 0,
        cache: { entries: 0 },
      })
    },
  )

  it.each([
    [1e16, 1, -1e16, 1],
    [Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE],
    [1e300, -1e300, 1e-300, -1e-300],
  ])('keeps ordered aggregate arithmetic for %j', (...values) => {
    const input = {
      kind: 'samples' as const,
      values: Float64Array.from(values),
      sampleRate: 1,
      startTime: 0,
    }
    const indexed = repository(input)
    const reference = repository(input, 0)
    for (const strategy of ['sum', 'average'] as const) {
      for (const target of [1, 2, 3]) {
        const request = { ...series(strategy, [0, 3]), maxPointCount: target }
        expect(sample(indexed, request)).toEqual(sample(reference, request))
      }
    }
    const sum = sample(indexed, { ...series('sum', [0, 3]), maxPointCount: 1 })
    if (values[0] === 1e16) expect(sum).toMatchObject({ y: new Float64Array([1]) })
    expect(indexed.resourceMetrics.indexBytes).toBe(0)
  })
})

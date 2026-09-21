import { describe, expect, it } from 'vitest'

import type { WaveformPoint } from '@/types'
import type { WorkerSamplingBackend, WorkerSamplingSeriesRequest } from './protocol'
import { WorkerSamplingRepository } from './repository'

const points: WaveformPoint[] = Array.from({ length: 32 }, (_, index) => ({
  x: index,
  y: index === 7 ? 90 : index,
}))

function register(repository: WorkerSamplingRepository, datasetId: string, source = points) {
  return repository.handle({
    type: 'register-dataset',
    requestId: 1,
    datasetId,
    revision: 0,
    points: source,
  })
}

function request(datasetId: string, revision = 1): WorkerSamplingSeriesRequest {
  return {
    seriesId: `${datasetId}-series`,
    datasetId,
    revision,
    xDomain: [0, 31],
    plotWidth: 3,
    mode: 'auto',
    autoThreshold: 2,
    strategy: 'peak',
    maxPointsPerPixel: 2,
    rawPointLimit: 5,
  }
}

describe('WorkerSamplingRepository cache lifecycle', () => {
  it('reports a real cache hit for a repeated viewport and misses after a rendering-key change', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'alpha')
    const series = { ...request('alpha'), lineType: 'linear' as const }
    const first = repository.handle({ type: 'sample-viewport', requestId: 20, series: [series] })
    const repeated = repository.handle({ type: 'sample-viewport', requestId: 21, series: [series] })
    const changed = repository.handle({
      type: 'sample-viewport',
      requestId: 22,
      series: [{ ...series, lineType: 'step-end' }],
    })

    expect(first).toMatchObject({ results: [{ diagnostics: { cacheHit: false } }] })
    expect(repeated).toMatchObject({ results: [{ diagnostics: { cacheHit: true } }] })
    expect(changed).toMatchObject({ results: [{ diagnostics: { cacheHit: false } }] })
    expect(repository.resourceMetrics.cache.entries).toBe(2)
  })

  it('invalidates cached outputs and releases indexes on revision replacement and disposal', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'alpha')
    const series = request('alpha')
    repository.handle({ type: 'sample-viewport', requestId: 23, series: [series] })
    expect(repository.resourceMetrics.indexBytes).toBeGreaterThan(0)
    expect(repository.resourceMetrics.cache.entries).toBe(1)

    repository.handle({
      type: 'replace-dataset',
      requestId: 24,
      datasetId: 'alpha',
      revision: 1,
      points: points.map((point) => ({ ...point, y: point.y + 1 })),
    })
    expect(repository.resourceMetrics).toMatchObject({ indexBytes: 0, cache: { entries: 0 } })
    const replacement = repository.handle({
      type: 'sample-viewport',
      requestId: 25,
      series: [{ ...series, revision: 2 }],
    })
    expect(replacement).toMatchObject({
      results: [{ diagnostics: { cacheHit: false, revision: 2 } }],
    })
    repository.handle({ type: 'dispose-dataset', requestId: 26, datasetId: 'alpha', revision: 2 })
    expect(repository.resourceMetrics).toMatchObject({ datasetCount: 0, indexBytes: 0 })
  })

  it('uses distinct cached outputs for each series in a shared viewport request', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'alpha')
    register(
      repository,
      'beta',
      points.map((point) => ({ ...point, y: -point.y })),
    )
    const series = [request('alpha'), request('beta')]

    repository.handle({ type: 'sample-viewport', requestId: 27, series })
    const repeated = repository.handle({ type: 'sample-viewport', requestId: 28, series })

    expect(repeated).toMatchObject({
      results: [{ diagnostics: { cacheHit: true } }, { diagnostics: { cacheHit: true } }],
    })
    repository.handle({ type: 'dispose-all', requestId: 29 })
    expect(repository.resourceMetrics).toMatchObject({
      datasetCount: 0,
      indexBytes: 0,
      cache: { entries: 0 },
    })
  })

  it('computes LTTB per viewport once, then reuses only the matching viewport result', () => {
    let calls = 0
    const javascriptBackend: WorkerSamplingBackend = {
      kind: 'javascript',
      sample: ({ points }) => {
        calls += 1
        return { kind: 'source-indexes', sourceIndexes: Uint32Array.from([0, points.length - 1]) }
      },
    }
    const repository = new WorkerSamplingRepository({ javascriptBackend })
    register(repository, 'alpha')
    const full = { ...request('alpha'), strategy: 'lttb' as const }
    const zoomed = { ...full, xDomain: [4, 19] as [number, number] }

    repository.handle({ type: 'sample-viewport', requestId: 30, series: [full] })
    const repeated = repository.handle({ type: 'sample-viewport', requestId: 31, series: [full] })
    repository.handle({ type: 'sample-viewport', requestId: 32, series: [zoomed] })

    expect(calls).toBe(2)
    expect(repeated).toMatchObject({ results: [{ diagnostics: { cacheHit: true } }] })
  })

  it('evicts least-recently-used sampled outputs at the configured entry bound', () => {
    const repository = new WorkerSamplingRepository({ cacheMaxEntries: 1 })
    register(repository, 'alpha')
    const full = request('alpha')
    const zoomed = { ...full, xDomain: [4, 19] as [number, number] }

    repository.handle({ type: 'sample-viewport', requestId: 33, series: [full] })
    repository.handle({ type: 'sample-viewport', requestId: 34, series: [zoomed] })
    const fullAgain = repository.handle({ type: 'sample-viewport', requestId: 35, series: [full] })

    expect(repository.resourceMetrics.cache).toMatchObject({ entries: 1, maxEntries: 1 })
    expect(fullAgain).toMatchObject({ results: [{ diagnostics: { cacheHit: false } }] })
  })

  it('bounds cache memory and reports lazily allocated index bytes through dataset metrics', () => {
    const repository = new WorkerSamplingRepository({ cacheMaxBytes: 8 })
    register(repository, 'alpha')
    const series = request('alpha')

    repository.handle({ type: 'sample-viewport', requestId: 36, series: [series] })
    const repeated = repository.handle({ type: 'sample-viewport', requestId: 37, series: [series] })
    const metrics = repository.handle({
      type: 'get-dataset-metrics',
      requestId: 38,
      datasetId: 'alpha',
      revision: 1,
    })

    expect(repeated).toMatchObject({ results: [{ diagnostics: { cacheHit: false } }] })
    expect(repository.resourceMetrics.cache).toMatchObject({ entries: 0, maxBytes: 8 })
    expect(metrics).toMatchObject({ status: 'ok', metrics: { indexBytes: expect.any(Number) } })
    if (metrics.type === 'dataset-response') expect(metrics.metrics?.indexBytes).toBeGreaterThan(0)
  })
})

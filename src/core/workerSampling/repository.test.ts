import { describe, expect, it } from 'vitest'

import type { WaveformPoint } from '@/types'
import { type WorkerSamplingBackend, type WorkerSamplingSeriesRequest } from './protocol'
import { WorkerSamplingRepository } from './repository'

const points: WaveformPoint[] = Array.from({ length: 12 }, (_, index) => ({
  x: index,
  y: index === 5 ? 100 : index,
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

function sampleSeries(datasetId: string, revision = 1): WorkerSamplingSeriesRequest {
  return {
    seriesId: `${datasetId}-series`,
    datasetId,
    revision,
    xDomain: [0, 11],
    plotWidth: 3,
    mode: 'auto',
    autoThreshold: 2,
    strategy: 'peak',
    maxPointsPerPixel: 2,
    rawPointLimit: 5,
  }
}

describe('WorkerSamplingRepository', () => {
  it('registers an immutable normalized dataset with revision one and metrics', () => {
    const repository = new WorkerSamplingRepository()
    const source = [
      { x: 2, y: 2 },
      { x: Number.NaN, y: 5 },
      { x: 1, y: 1 },
    ]

    const response = register(repository, 'alpha', source)

    expect(response).toMatchObject({
      type: 'dataset-response',
      datasetId: 'alpha',
      requestId: 1,
      revision: 1,
      status: 'ok',
      metrics: { inputPointCount: 3, validPointCount: 2, xDomain: [1, 2], yDomain: [1, 2] },
    })
    source[0]!.x = 99
    const nearest = repository.handle({
      type: 'find-nearest-point',
      requestId: 2,
      datasetId: 'alpha',
      revision: 1,
      x: 2,
    })
    expect(nearest).toMatchObject({ status: 'ok', point: { x: 2, y: 2 } })
    expect(
      repository.handle({
        type: 'get-dataset-metrics',
        requestId: 3,
        datasetId: 'alpha',
        revision: 1,
      }),
    ).toMatchObject({ status: 'ok', metrics: { validPointCount: 2 } })
  })

  it('requires the current revision for replacement and invalidates earlier queries', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'alpha')

    expect(
      repository.handle({
        type: 'replace-dataset',
        requestId: 2,
        datasetId: 'alpha',
        revision: 0,
        points: [{ x: 10, y: 10 }],
      }),
    ).toMatchObject({ status: 'stale-revision', revision: 1 })
    expect(
      repository.handle({
        type: 'replace-dataset',
        requestId: 3,
        datasetId: 'alpha',
        revision: 1,
        points: [{ x: 10, y: 10 }],
      }),
    ).toMatchObject({ status: 'ok', revision: 2 })
    expect(
      repository.handle({
        type: 'get-dataset-metrics',
        requestId: 4,
        datasetId: 'alpha',
        revision: 1,
      }),
    ).toMatchObject({ status: 'stale-revision', revision: 2 })
  })

  it('samples visible series in one request with independent auto and raw diagnostics', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'sampled')
    register(repository, 'raw')
    const raw = {
      ...sampleSeries('raw'),
      mode: 'raw' as const,
      xDomain: [3, 9] as [number, number],
    }
    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 5,
      series: [sampleSeries('sampled'), raw],
    })

    expect(response.type).toBe('sample-viewport-response')
    if (response.type !== 'sample-viewport-response') return
    expect(response.results).toHaveLength(2)
    expect(response.results[0]).toMatchObject({
      status: 'ok',
      output: { kind: 'source-indexes' },
      diagnostics: {
        mode: 'auto',
        selectedMode: 'sampled',
        backend: 'javascript',
        visiblePointCount: 12,
        requestId: 5,
        revision: 1,
      },
    })
    expect(response.results[0]?.output?.kind === 'source-indexes').toBe(true)
    const sampled = response.results[0]?.output
    expect(sampled?.kind === 'source-indexes' ? [...sampled.sourceIndexes] : []).toContain(5)
    expect(response.results[1]).toMatchObject({
      status: 'ok',
      diagnostics: {
        mode: 'raw',
        selectedMode: 'raw',
        backend: 'raw',
        visiblePointCount: 7,
        rawPointLimitExceeded: true,
      },
    })
  })

  it('returns raw source indexes at the auto threshold and does not pretend wasm is JavaScript', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'alpha')
    const atThreshold = {
      ...sampleSeries('alpha'),
      xDomain: [2, 4] as [number, number],
      autoThreshold: 3,
    }
    const forcedWasm = { ...sampleSeries('alpha'), mode: 'wasm' as const }
    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 6,
      series: [atThreshold, forcedWasm],
    })

    expect(response.type).toBe('sample-viewport-response')
    if (response.type !== 'sample-viewport-response') return
    expect(response.results[0]).toMatchObject({
      status: 'ok',
      output: { kind: 'source-indexes', sourceIndexes: Uint32Array.from([2, 3, 4]) },
      diagnostics: { selectedMode: 'raw', backend: 'raw', visiblePointCount: 3 },
    })
    expect(response.results[1]).toMatchObject({
      status: 'wasm-unavailable',
      output: undefined,
      diagnostics: { selectedMode: 'sampled', backend: 'unavailable' },
    })
  })

  it('uses JavaScript only when a forced WASM fallback explicitly allows it', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'alpha')
    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 61,
      series: [{ ...sampleSeries('alpha'), mode: 'wasm', wasmFailureFallback: 'javascript' }],
    })

    expect(response).toMatchObject({
      type: 'sample-viewport-response',
      results: [
        {
          status: 'wasm-unavailable',
          output: { kind: 'source-indexes' },
          diagnostics: { backend: 'javascript', selectedMode: 'sampled' },
        },
      ],
    })
  })

  it('uses auto hysteresis only while a previous interaction selection is supplied', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'alpha')
    const request = {
      ...sampleSeries('alpha'),
      xDomain: [0, 3] as [number, number],
      autoThreshold: 3,
      autoHysteresis: 1,
    }
    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 7,
      series: [
        { ...request, previousSelectedMode: 'raw' },
        { ...request, previousSelectedMode: 'sampled' },
        request,
      ],
    })

    expect(response.type).toBe('sample-viewport-response')
    if (response.type !== 'sample-viewport-response') return
    expect(response.results.map((result) => result.diagnostics.selectedMode)).toEqual([
      'raw',
      'sampled',
      'sampled',
    ])
  })

  it('uses the default 1,000-point auto threshold per series', () => {
    const repository = new WorkerSamplingRepository()
    const source = Array.from({ length: 1_001 }, (_, index) => ({ x: index, y: index }))
    register(repository, 'alpha', source)
    const request = { ...sampleSeries('alpha'), autoThreshold: undefined, plotWidth: 100 }
    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 8,
      series: [
        { ...request, seriesId: 'at-threshold', xDomain: [0, 999] },
        { ...request, seriesId: 'over-threshold', xDomain: [0, 1_000] },
      ],
    })

    expect(response.type).toBe('sample-viewport-response')
    if (response.type !== 'sample-viewport-response') return
    expect(response.results.map((result) => result.diagnostics.selectedMode)).toEqual([
      'raw',
      'sampled',
    ])
    expect(response.results.map((result) => result.diagnostics.backend)).toEqual([
      'raw',
      'javascript',
    ])
  })

  it('uses an explicitly injected wasm backend only when forced', () => {
    const wasmBackend: WorkerSamplingBackend = {
      kind: 'wasm',
      sample: () => ({ kind: 'source-indexes', sourceIndexes: Uint32Array.from([1]) }),
    }
    const repository = new WorkerSamplingRepository({ wasmBackend })
    register(repository, 'alpha')
    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 9,
      series: [{ ...sampleSeries('alpha'), mode: 'wasm' }],
    })

    expect(response).toMatchObject({
      type: 'sample-viewport-response',
      results: [
        {
          status: 'ok',
          output: { kind: 'source-indexes', sourceIndexes: Uint32Array.from([1]) },
          diagnostics: { backend: 'wasm' },
        },
      ],
    })
  })

  it('keeps TypedArray datasets numeric through the WASM request and maps local indexes globally', () => {
    let backendRequest:
      { x: Float64Array; y: Float64Array; points: readonly WaveformPoint[] } | undefined
    const repository = new WorkerSamplingRepository({
      wasmBackend: {
        kind: 'wasm',
        sample: (request) => {
          backendRequest = request
          return { kind: 'source-indexes', sourceIndexes: Uint32Array.from([1]) }
        },
      },
    })
    const x = new Float64Array([0, 1, 2, 3])
    const y = new Float32Array([0, 10, 20, 30])
    repository.handle({
      type: 'register-dataset',
      requestId: 90,
      datasetId: 'compact',
      revision: 0,
      dataset: { kind: 'typed', x, y },
    })
    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 91,
      series: [
        {
          ...sampleSeries('compact'),
          mode: 'wasm',
          xDomain: [1, 3],
          maxPointsPerPixel: 1,
        },
      ],
    })

    expect(backendRequest?.x).toEqual(new Float64Array([1, 2, 3]))
    expect(backendRequest?.y).toEqual(new Float64Array([10, 20, 30]))
    expect(backendRequest?.points).toEqual([])
    expect(response).toMatchObject({
      results: [
        { output: { sourceIndexes: Uint32Array.from([2]) }, diagnostics: { backend: 'wasm' } },
      ],
    })
    expect(repository.resourceMetrics.indexBytes).toBe(0)
  })

  it('uses a WASM backend enabled after Worker initialization', () => {
    let calls = 0
    const repository = new WorkerSamplingRepository()
    repository.setWasmBackend({
      kind: 'wasm',
      sample: () => {
        calls += 1
        return { kind: 'source-indexes', sourceIndexes: Uint32Array.from([2]) }
      },
    })
    register(repository, 'alpha')

    const response = repository.handle({
      type: 'sample-viewport',
      requestId: 91,
      series: [sampleSeries('alpha')],
    })

    expect(calls).toBe(1)
    expect(response).toMatchObject({
      results: [
        {
          output: { sourceIndexes: Uint32Array.from([2]) },
          diagnostics: { backend: 'wasm' },
        },
      ],
    })
  })

  it('finds nearest full-source points and disposes datasets only at the current revision', () => {
    const repository = new WorkerSamplingRepository()
    register(repository, 'alpha')
    register(repository, 'beta')

    expect(
      repository.handle({
        type: 'find-nearest-point',
        requestId: 8,
        datasetId: 'alpha',
        revision: 1,
        x: 5.2,
      }),
    ).toMatchObject({ status: 'ok', point: points[5] })
    expect(
      repository.handle({
        type: 'find-nearest-point',
        requestId: 9,
        datasetId: 'alpha',
        revision: 1,
        x: 12,
      }),
    ).toMatchObject({ status: 'ok', point: undefined })
    expect(
      repository.handle({
        type: 'dispose-dataset',
        requestId: 10,
        datasetId: 'alpha',
        revision: 0,
      }),
    ).toMatchObject({ status: 'stale-revision' })
    expect(
      repository.handle({
        type: 'dispose-dataset',
        requestId: 11,
        datasetId: 'alpha',
        revision: 1,
      }),
    ).toMatchObject({ status: 'ok' })
    expect(repository.handle({ type: 'dispose-all', requestId: 12 })).toEqual({
      type: 'dispose-all-response',
      requestId: 12,
      disposedDatasetIds: ['beta'],
    })
  })
})

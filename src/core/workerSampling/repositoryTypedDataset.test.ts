import { describe, expect, it } from 'vitest'

import { WorkerSamplingRepository } from './repository'

describe('WorkerSamplingRepository typed datasets', () => {
  it('copies, filters, and stably orders typed columns without materializing point objects', () => {
    const repository = new WorkerSamplingRepository()
    const x = Float64Array.from([2, Number.NaN, 1, 1, 3])
    const y = Float32Array.from([20, 99, 10, 11, Number.POSITIVE_INFINITY])
    repository.handle({
      type: 'register-dataset',
      requestId: 80,
      datasetId: 'typed',
      revision: 0,
      dataset: { kind: 'typed', x, y },
    })
    x[0] = 99
    y[2] = 99

    const sampled = repository.handle({
      type: 'sample-viewport',
      requestId: 81,
      series: [
        {
          seriesId: 'typed',
          datasetId: 'typed',
          revision: 1,
          xDomain: [1, 2],
          plotWidth: 10,
          mode: 'raw',
          strategy: 'peak',
        },
      ],
    })
    const belowRange = repository.handle({
      type: 'find-nearest-point',
      requestId: 82,
      datasetId: 'typed',
      revision: 1,
      x: 0,
    })

    expect(sampled).toMatchObject({
      results: [
        {
          output: { kind: 'source-indexes', sourceIndexes: Uint32Array.from([0, 1, 2]) },
        },
      ],
    })
    expect(belowRange).toMatchObject({ status: 'ok', point: undefined })
  })

  it('derives sample X values from compact metadata and preserves source-time gaps', () => {
    const repository = new WorkerSamplingRepository()
    const values = new Float32Array([2, 6])
    repository.handle({
      type: 'register-dataset',
      requestId: 90,
      datasetId: 'samples',
      revision: 0,
      dataset: {
        kind: 'samples',
        values,
        sampleRate: 2,
        startTime: 10,
        sourceIndexes: new Uint32Array([0, 2]),
      },
    })
    values[0] = 99

    expect(
      repository.handle({
        type: 'find-nearest-point',
        requestId: 91,
        datasetId: 'samples',
        revision: 1,
        x: 10.9,
      }),
    ).toMatchObject({ point: { x: 11, y: 6 } })
    expect(
      repository.handle({
        type: 'get-dataset-metrics',
        requestId: 92,
        datasetId: 'samples',
        revision: 1,
      }),
    ).toMatchObject({ metrics: { validPointCount: 2, xDomain: [10, 11], yDomain: [2, 6] } })
  })
})

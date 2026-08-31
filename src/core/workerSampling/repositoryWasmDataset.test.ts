import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { createInitializedWasmSamplingBackend, initializeWasmSampling } from '../wasmSampling'
import { WorkerSamplingRepository } from './repository'

describe('WorkerSamplingRepository WASM datasets', () => {
  beforeAll(async () => {
    await initializeWasmSampling(
      await readFile(resolve(process.cwd(), 'wasm/pkg/waveform_sampling_wasm_bg.wasm')),
    )
  })

  it('registers typed columns in WASM, reports lazy index bytes, and releases handles on replace', () => {
    const repository = new WorkerSamplingRepository({
      wasmBackend: createInitializedWasmSamplingBackend(),
      indexMaxBytes: 1024 * 1024,
    })
    const register = repository.handle({
      type: 'register-dataset',
      requestId: 1,
      datasetId: 'typed',
      revision: 0,
      dataset: {
        kind: 'typed',
        x: Float64Array.from({ length: 65 }, (_, index) => index / 100),
        y: Float32Array.from({ length: 65 }, (_, index) => (index === 31 ? 50 : index)),
      },
    })
    const sampled = repository.handle({
      type: 'sample-viewport',
      requestId: 2,
      series: [
        {
          seriesId: 'typed',
          datasetId: 'typed',
          revision: 1,
          xDomain: [0.03, 0.61],
          plotWidth: 4,
          mode: 'wasm',
          strategy: 'peak',
          maxPointsPerPixel: 2,
        },
      ],
    })

    expect(register).toMatchObject({ status: 'ok', metrics: { indexBytes: 0 } })
    expect(sampled).toMatchObject({ results: [{ diagnostics: { backend: 'wasm' } }] })
    expect(repository.resourceMetrics.indexBytes).toBeGreaterThan(0)

    const replaced = repository.handle({
      type: 'replace-dataset',
      requestId: 3,
      datasetId: 'typed',
      revision: 1,
      dataset: {
        kind: 'typed',
        x: Float64Array.from([0, 1]),
        y: Float32Array.from([1, 2]),
      },
    })

    expect(replaced).toMatchObject({ status: 'ok', revision: 2, metrics: { indexBytes: 0 } })
    expect(repository.resourceMetrics.indexBytes).toBe(0)
    repository.handle({ type: 'dispose-all', requestId: 4 })
    expect(repository.resourceMetrics).toMatchObject({ datasetCount: 0, indexBytes: 0 })
  })
})

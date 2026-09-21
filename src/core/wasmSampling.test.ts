/// <reference types="node" />

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { sampleWaveformReference } from './samplingReference'
import {
  REFERENCE_AGGREGATE_VECTORS,
  REFERENCE_SAMPLING_POINTS,
  REFERENCE_SOURCE_INDEX_VECTORS,
} from './samplingReferenceVectors'
import {
  calculateWasmRange,
  createInitializedWasmSamplingBackend,
  findWasmVisibleRange,
  initializeWasmSampling,
  sampleWaveformWasm,
} from './wasmSampling'

const x = Float64Array.from(REFERENCE_SAMPLING_POINTS, (point) => point.x)
const y = Float64Array.from(REFERENCE_SAMPLING_POINTS, (point) => point.y)

describe('sampleWaveformWasm', () => {
  beforeAll(async () => {
    await initializeWasmSampling(
      await readFile(resolve(process.cwd(), 'wasm/pkg/waveform_sampling_wasm_bg.wasm')),
    )
  })

  it('matches the shared source-index vectors and TypeScript reference', async () => {
    for (const vector of REFERENCE_SOURCE_INDEX_VECTORS) {
      const wasm = await sampleWaveformWasm({ x, y, ...vector })
      const reference = sampleWaveformReference({
        points: REFERENCE_SAMPLING_POINTS,
        strategy: vector.strategy,
        targetPointCount: vector.targetPointCount,
      })

      expect(wasm.kind).toBe('source-indexes')
      expect(reference.kind).toBe('source-indexes')
      if (wasm.kind === 'source-indexes' && reference.kind === 'source-indexes') {
        expect(Array.from(wasm.sourceIndexes)).toEqual(vector.expectedSourceIndexes)
        expect(Array.from(wasm.sourceIndexes)).toEqual(Array.from(reference.sourceIndexes))
      }
    }
  })

  it('matches the shared aggregate vectors and TypeScript reference', async () => {
    for (const vector of REFERENCE_AGGREGATE_VECTORS) {
      const wasm = await sampleWaveformWasm({ x, y, ...vector })
      const reference = sampleWaveformReference({
        points: REFERENCE_SAMPLING_POINTS,
        strategy: vector.strategy,
        targetPointCount: vector.targetPointCount,
      })

      expect(wasm.kind).toBe('aggregates')
      expect(reference.kind).toBe('aggregates')
      if (wasm.kind === 'aggregates' && reference.kind === 'aggregates') {
        expect(Array.from(wasm.x)).toEqual(vector.expectedX)
        expect(Array.from(wasm.y)).toEqual(vector.expectedY)
        expect(Array.from(wasm.x)).toEqual(Array.from(reference.x))
        expect(Array.from(wasm.y)).toEqual(Array.from(reference.y))
      }
    }
  })

  it('preserves reference filtering, stable sorting, and original source indexes', async () => {
    const wasm = await sampleWaveformWasm({
      x: Float64Array.from([2, Number.NaN, 1, 1, 3]),
      y: Float64Array.from([20, 99, 10, 11, Number.POSITIVE_INFINITY]),
      strategy: 'none',
      targetPointCount: 1,
    })

    expect(wasm).toEqual({ kind: 'source-indexes', sourceIndexes: Uint32Array.from([2, 3, 0]) })
  })

  it('calculates full domains and normalized visible ranges', async () => {
    const range = await calculateWasmRange(
      Float64Array.from([2, Number.NaN, 1, 1, 3]),
      Float64Array.from([20, 99, 10, 11, Number.POSITIVE_INFINITY]),
    )
    const visible = await findWasmVisibleRange(
      Float64Array.from([2, Number.NaN, 1, 1, 3]),
      Float64Array.from([20, 99, 10, 11, Number.POSITIVE_INFINITY]),
      [1, 1],
    )

    expect(range).toEqual({ x: [1, 2], y: [10, 20] })
    expect(visible).toEqual([0, 2])
    await expect(calculateWasmRange(Float64Array.of(0), new Float64Array())).rejects.toThrow(
      'x and y must have the same length',
    )
  })

  it('matches the reference across strategy and target boundary cases', async () => {
    const points = [
      { x: 3, y: 3 },
      { x: 1, y: -2 },
      { x: 1, y: 4 },
      { x: Number.NaN, y: 6 },
      { x: 2, y: -1 },
      { x: 4, y: Number.POSITIVE_INFINITY },
      { x: 5, y: 0 },
    ]
    const caseX = Float64Array.from(points, (point) => point.x)
    const caseY = Float64Array.from(points, (point) => point.y)
    const strategies = ['none', 'peak', 'lttb', 'average', 'min', 'max', 'minmax', 'sum'] as const
    const targets = [0, 1, 2, 3, 6, 20, Number.POSITIVE_INFINITY]

    for (const strategy of strategies) {
      for (const targetPointCount of targets) {
        const wasm = await sampleWaveformWasm({
          x: caseX,
          y: caseY,
          strategy,
          targetPointCount,
        })
        const reference = sampleWaveformReference({ points, strategy, targetPointCount })

        expect(wasm.kind).toBe(reference.kind)
        if (wasm.kind === 'source-indexes' && reference.kind === 'source-indexes') {
          expect(Array.from(wasm.sourceIndexes)).toEqual(Array.from(reference.sourceIndexes))
        }
        if (wasm.kind === 'aggregates' && reference.kind === 'aggregates') {
          expect(Array.from(wasm.x)).toEqual(Array.from(reference.x))
          expect(Array.from(wasm.y)).toEqual(Array.from(reference.y))
        }
      }
    }
  })

  it('rejects coordinate arrays with unequal lengths', async () => {
    await expect(
      sampleWaveformWasm({
        x: Float64Array.of(0),
        y: new Float64Array(),
        strategy: 'none',
        targetPointCount: 1,
      }),
    ).rejects.toThrow('x and y must have the same length')
  })

  it('keeps a bounded dataset index in WASM for unaligned viewport queries and releases it', () => {
    const backend = createInitializedWasmSamplingBackend()
    const handle = backend.registerDataset(x, y, 1024 * 1024)
    const visible = REFERENCE_SAMPLING_POINTS.slice(2, 9)

    for (const strategy of ['peak', 'min', 'max', 'minmax'] as const) {
      const actual = backend.sampleDataset(handle, 2, 9, strategy, 6)
      const expected = sampleWaveformReference({
        points: visible,
        strategy,
        targetPointCount: 6,
      })
      expect(actual.kind).toBe('source-indexes')
      expect(expected.kind).toBe('source-indexes')
      if (actual.kind === 'source-indexes' && expected.kind === 'source-indexes') {
        expect(Array.from(actual.sourceIndexes)).toEqual(
          Array.from(expected.sourceIndexes, (index) => index + 2),
        )
      }
    }

    const aggregates = backend.sampleDataset(handle, 2, 9, 'average', 4)
    const expectedAggregates = sampleWaveformReference({
      points: visible,
      strategy: 'average',
      targetPointCount: 4,
    })
    expect(aggregates.kind).toBe('aggregates')
    expect(expectedAggregates.kind).toBe('aggregates')
    if (aggregates.kind === 'aggregates' && expectedAggregates.kind === 'aggregates') {
      aggregates.x.forEach((value, index) =>
        expect(value).toBeCloseTo(expectedAggregates.x[index]!, 12),
      )
      aggregates.y.forEach((value, index) =>
        expect(value).toBeCloseTo(expectedAggregates.y[index]!, 12),
      )
    }
    expect(backend.datasetIndexBytes(handle)).toBeGreaterThan(0)
    backend.disposeDataset(handle)
    expect(backend.datasetIndexBytes(handle)).toBe(0)
  })

  it('registers evenly sampled values without an explicit X column', () => {
    const backend = createInitializedWasmSamplingBackend()
    const handle = backend.registerSamples(
      new Float64Array([1, 9, 2]),
      new Uint32Array([0, 2, 3]),
      10,
      2,
      1024 * 1024,
    )

    expect(backend.sampleDataset(handle, 0, 3, 'max', 3)).toMatchObject({
      kind: 'source-indexes',
      sourceIndexes: Uint32Array.from([0, 1, 2]),
    })
    backend.disposeDataset(handle)
  })
})

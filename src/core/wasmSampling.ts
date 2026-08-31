import initWasm, {
  calculate_range,
  dataset_index_bytes,
  dispose_all_datasets,
  dispose_dataset,
  find_visible_range,
  register_dataset,
  register_sample_dataset,
  sample_aggregates,
  sample_dataset_aggregates,
  sample_dataset_indexes,
  sample_indexes,
} from '../../wasm/pkg/waveform_sampling_wasm'
import type { InitInput } from '../../wasm/pkg/waveform_sampling_wasm'

import type { ReferenceSamplingStrategy } from './samplingReference'
import type { WorkerSamplingBackend, WorkerSamplingOutput } from './workerSampling/protocol'

export type WasmSamplingStrategy = ReferenceSamplingStrategy

export interface WasmSamplingRequest {
  x: Float64Array
  y: Float64Array
  strategy: WasmSamplingStrategy
  targetPointCount: number
}

export interface WasmSourceIndexSamplingResult {
  kind: 'source-indexes'
  sourceIndexes: Uint32Array
}

export interface WasmAggregateSamplingResult {
  kind: 'aggregates'
  x: Float64Array
  y: Float64Array
}

export type WasmSamplingResult = WasmSourceIndexSamplingResult | WasmAggregateSamplingResult

export interface WasmDatasetSamplingBackend extends WorkerSamplingBackend {
  registerDataset(x: Float64Array, y: Float64Array, indexMaxBytes?: number): number
  registerSamples(
    y: Float64Array,
    sourceIndexes: Uint32Array | undefined,
    startTime: number,
    sampleRate: number,
    indexMaxBytes?: number,
  ): number
  disposeDataset(handle: number): void
  disposeAllDatasets(): void
  datasetIndexBytes(handle: number): number
  sampleDataset(
    handle: number,
    start: number,
    end: number,
    strategy: WasmSamplingStrategy,
    targetPointCount: number,
  ): WorkerSamplingOutput
}

export interface WasmRangeMetrics {
  x: [number, number]
  y: [number, number]
}

const strategyCodes: Record<WasmSamplingStrategy, number> = {
  none: 0,
  peak: 1,
  lttb: 2,
  average: 3,
  min: 4,
  max: 5,
  minmax: 6,
  sum: 7,
}

let initialization: Promise<void> | undefined

function targetPointCountForWasm(value: number, pointCount: number) {
  if (pointCount === 0) return 0
  if (!Number.isFinite(value)) return pointCount
  return Math.min(pointCount, Math.max(1, Math.floor(value)))
}

function validateRequest(request: WasmSamplingRequest) {
  if (request.x.length !== request.y.length) {
    throw new Error('x and y must have the same length')
  }
}

/** Initializes the bundled WebAssembly module once for the current JavaScript realm. */
export function initializeWasmSampling(input?: InitInput | Promise<InitInput>): Promise<void> {
  initialization ??= Promise.resolve(initWasm(input)).then(() => undefined)
  return initialization
}

/**
 * Runs the pure numeric sampler on flat Float64Array coordinates. The caller owns source-data
 * normalization and receives either original input indexes or newly allocated aggregate arrays.
 */
export async function sampleWaveformWasm(
  request: WasmSamplingRequest,
): Promise<WasmSamplingResult> {
  validateRequest(request)
  await initializeWasmSampling()
  const target = targetPointCountForWasm(request.targetPointCount, request.x.length)
  const strategy = strategyCodes[request.strategy]
  if (request.strategy !== 'average' && request.strategy !== 'sum') {
    return {
      kind: 'source-indexes',
      sourceIndexes: sample_indexes(request.x, request.y, strategy, target),
    }
  }

  const values = sample_aggregates(request.x, request.y, strategy, target)
  const x = new Float64Array(values.length / 2)
  const y = new Float64Array(values.length / 2)
  for (let index = 0; index < x.length; index += 1) {
    x[index] = values[index * 2]!
    y[index] = values[index * 2 + 1]!
  }
  return { kind: 'aggregates', x, y }
}

/**
 * Creates the synchronous backend used only after this realm has finished WASM initialization.
 * Worker code calls `initializeWasmSampling` before exposing this backend to its repository.
 */
export function createInitializedWasmSamplingBackend(): WasmDatasetSamplingBackend {
  const aggregateOutput = (values: Float64Array): WasmAggregateSamplingResult => {
    const x = new Float64Array(values.length / 2)
    const y = new Float64Array(values.length / 2)
    for (let index = 0; index < x.length; index += 1) {
      x[index] = values[index * 2]!
      y[index] = values[index * 2 + 1]!
    }
    return { kind: 'aggregates', x, y }
  }
  const backend: WasmDatasetSamplingBackend = {
    kind: 'wasm',
    sample({ x, y, strategy, targetPointCount }) {
      const request = { x, y, strategy, targetPointCount }
      validateRequest(request)
      const target = targetPointCountForWasm(request.targetPointCount, request.x.length)
      if (request.strategy !== 'average' && request.strategy !== 'sum') {
        return {
          kind: 'source-indexes' as const,
          sourceIndexes: sample_indexes(
            request.x,
            request.y,
            strategyCodes[request.strategy],
            target,
          ),
        }
      }
      const values = sample_aggregates(
        request.x,
        request.y,
        strategyCodes[request.strategy],
        target,
      )
      return aggregateOutput(values)
    },
    registerDataset(x, y, indexMaxBytes) {
      validateRequest({ x, y, strategy: 'peak', targetPointCount: x.length })
      return register_dataset(
        x,
        y,
        Math.max(0, Math.min(0xffffffff, Math.floor(indexMaxBytes ?? 8 * 1024 * 1024))),
      )
    },
    registerSamples(y, sourceIndexes, startTime, sampleRate, indexMaxBytes) {
      return register_sample_dataset(
        y,
        sourceIndexes ?? new Uint32Array(),
        startTime,
        sampleRate,
        Math.max(0, Math.min(0xffffffff, Math.floor(indexMaxBytes ?? 8 * 1024 * 1024))),
      )
    },
    disposeDataset(handle) {
      dispose_dataset(handle)
    },
    disposeAllDatasets() {
      dispose_all_datasets()
    },
    datasetIndexBytes(handle) {
      return dataset_index_bytes(handle)
    },
    sampleDataset(handle, start, end, strategy, targetPointCount) {
      const target = Math.max(0, Math.floor(targetPointCount))
      if (strategy === 'average' || strategy === 'sum') {
        return aggregateOutput(
          sample_dataset_aggregates(handle, start, end, strategyCodes[strategy], target),
        )
      }
      return {
        kind: 'source-indexes',
        sourceIndexes: sample_dataset_indexes(handle, start, end, strategyCodes[strategy], target),
      }
    },
  }
  return backend
}

/** Calculates domains from valid points without changing the input arrays. */
export async function calculateWasmRange(
  x: Float64Array,
  y: Float64Array,
): Promise<WasmRangeMetrics | undefined> {
  if (x.length !== y.length) throw new Error('x and y must have the same length')
  await initializeWasmSampling()
  const result = calculate_range(x, y)
  return result.length === 4
    ? { x: [result[0]!, result[1]!], y: [result[2]!, result[3]!] }
    : undefined
}

/** Locates a half-open visible range in the filtered, stable ascending-X point sequence. */
export async function findWasmVisibleRange(
  x: Float64Array,
  y: Float64Array,
  domain: [number, number],
): Promise<[number, number]> {
  if (x.length !== y.length) throw new Error('x and y must have the same length')
  await initializeWasmSampling()
  const result = find_visible_range(x, y, domain[0], domain[1])
  return [result[0]!, result[1]!]
}

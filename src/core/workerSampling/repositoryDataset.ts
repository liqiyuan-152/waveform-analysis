import type { WaveformPoint } from '@/types'
import type { WorkerSamplingDataset } from '../waveformPointSource'
import type { WasmDatasetSamplingBackend } from '../wasmSampling'
import { MultiResolutionSamplingIndex } from './multiresolution'
import type { WorkerSamplingBackend, WorkerSamplingDatasetMetrics } from './protocol'
import { copyFinitePoints, metricsFor, metricsForValues } from './repositorySupport'

export interface StoredDataset {
  x?: Float64Array
  y: Float64Array
  sampleStartTime?: number
  sampleRate?: number
  sampleSourceIndexes?: Uint32Array
  points?: WaveformPoint[]
  revision: number
  metrics: WorkerSamplingDatasetMetrics
  index?: MultiResolutionSamplingIndex
  wasmDatasetHandle?: number
  wasmIndexBytes?: number
}

export function datasetLength(dataset: StoredDataset | undefined) {
  return dataset?.y.length ?? 0
}

export function datasetXAt(dataset: StoredDataset, index: number) {
  if (dataset.x) return dataset.x[index]!
  return (
    dataset.sampleStartTime! + (dataset.sampleSourceIndexes?.[index] ?? index) / dataset.sampleRate!
  )
}

export function datasetVisibleRange(dataset: StoredDataset, domain: [number, number]) {
  const lowerBound = (value: number, inclusive: boolean) => {
    let start = 0
    let end = datasetLength(dataset)
    while (start < end) {
      const middle = start + Math.floor((end - start) / 2)
      if (inclusive ? datasetXAt(dataset, middle) <= value : datasetXAt(dataset, middle) < value) {
        start = middle + 1
      } else end = middle
    }
    return start
  }
  const startX = Math.min(domain[0], domain[1])
  const endX = Math.max(domain[0], domain[1])
  return { start: lowerBound(startX, false), end: lowerBound(endX, true) }
}

export function datasetXRange(dataset: StoredDataset, start: number, end: number) {
  if (dataset.x) return dataset.x.subarray(start, end)
  return Float64Array.from({ length: end - start }, (_, offset) =>
    datasetXAt(dataset, start + offset),
  )
}

export function isWasmDatasetBackend(
  backend: WorkerSamplingBackend | undefined,
): backend is WasmDatasetSamplingBackend {
  return (
    backend?.kind === 'wasm' &&
    'registerDataset' in backend &&
    'disposeDataset' in backend &&
    'disposeAllDatasets' in backend &&
    'datasetIndexBytes' in backend &&
    'registerSamples' in backend &&
    'sampleDataset' in backend
  )
}

function copyFiniteNumericValues(sourceX: Float64Array, sourceY: Float32Array | Float64Array) {
  const indexes: number[] = []
  const length = Math.min(sourceX.length, sourceY.length)
  for (let index = 0; index < length; index += 1) {
    if (Number.isFinite(sourceX[index]) && Number.isFinite(sourceY[index])) indexes.push(index)
  }
  indexes.sort((left, right) => sourceX[left]! - sourceX[right]! || left - right)
  return {
    x: Float64Array.from(indexes, (index) => sourceX[index]!),
    y: Float64Array.from(indexes, (index) => sourceY[index]!),
  }
}

export function createStoredDataset(
  input: readonly WaveformPoint[] | undefined,
  numeric: WorkerSamplingDataset | undefined,
  revision: number,
  indexMaxBytes: number | undefined,
): StoredDataset {
  if (numeric?.kind === 'typed') {
    const normalized = copyFiniteNumericValues(numeric.x, numeric.y)
    return {
      x: normalized.x,
      y: normalized.y,
      revision,
      metrics: metricsForValues(
        normalized.x,
        normalized.y,
        Math.max(numeric.x.length, numeric.y.length),
      ),
    }
  }
  if (numeric?.kind === 'samples') {
    const validMetadata =
      Number.isFinite(numeric.sampleRate) &&
      numeric.sampleRate > 0 &&
      Number.isFinite(numeric.startTime) &&
      (!numeric.sourceIndexes || numeric.sourceIndexes.length === numeric.values.length)
    if (!validMetadata) {
      return {
        y: new Float64Array(),
        sampleStartTime: 0,
        sampleRate: 1,
        revision,
        metrics: {
          inputPointCount: numeric.values.length,
          validPointCount: 0,
          xDomain: null,
          yDomain: null,
        },
      }
    }
    const indexes = Array.from({ length: numeric.values.length }, (_, index) => index).filter(
      (index) => Number.isFinite(numeric.values[index]),
    )
    const sourceIndexAt = (index: number) => numeric.sourceIndexes?.[index] ?? index
    indexes.sort((left, right) => sourceIndexAt(left) - sourceIndexAt(right) || left - right)
    const y = Float64Array.from(indexes, (index) => numeric.values[index]!)
    const sourceIndexes = Uint32Array.from(indexes, sourceIndexAt)
    const xAt = (index: number) => numeric.startTime + sourceIndexes[index]! / numeric.sampleRate
    let yMinimum = Number.POSITIVE_INFINITY
    let yMaximum = Number.NEGATIVE_INFINITY
    for (const value of y) {
      yMinimum = Math.min(yMinimum, value)
      yMaximum = Math.max(yMaximum, value)
    }
    return {
      y,
      sampleStartTime: numeric.startTime,
      sampleRate: numeric.sampleRate,
      sampleSourceIndexes:
        sourceIndexes.length === numeric.values.length &&
        sourceIndexes.every((value, index) => value === index)
          ? undefined
          : sourceIndexes,
      revision,
      metrics: {
        inputPointCount: numeric.values.length,
        validPointCount: y.length,
        xDomain: y.length ? [xAt(0), xAt(y.length - 1)] : null,
        yDomain: y.length ? [yMinimum, yMaximum] : null,
      },
    }
  }
  const copied = copyFinitePoints(input ?? numeric?.points ?? [])
  const x = Float64Array.from(copied, (point) => point.x)
  const y = Float64Array.from(copied, (point) => point.y)
  return {
    x,
    y,
    points: copied,
    revision,
    metrics: metricsFor(copied, input?.length ?? numeric?.points.length ?? 0),
    index: new MultiResolutionSamplingIndex(copied, { maxBytes: indexMaxBytes }),
  }
}

export function registerWasmDataset(
  backend: WorkerSamplingBackend | undefined,
  dataset: StoredDataset,
  indexMaxBytes: number | undefined,
) {
  if (!isWasmDatasetBackend(backend) || dataset.wasmDatasetHandle !== undefined) return
  dataset.wasmDatasetHandle = dataset.x
    ? backend.registerDataset(dataset.x, dataset.y, indexMaxBytes)
    : backend.registerSamples(
        dataset.y,
        dataset.sampleSourceIndexes,
        dataset.sampleStartTime!,
        dataset.sampleRate!,
        indexMaxBytes,
      )
  dataset.wasmIndexBytes = backend.datasetIndexBytes(dataset.wasmDatasetHandle)
}

export function disposeDatasetIndexes(
  backend: WorkerSamplingBackend | undefined,
  dataset: StoredDataset,
) {
  dataset.index?.dispose()
  if (dataset.wasmDatasetHandle !== undefined && isWasmDatasetBackend(backend)) {
    backend.disposeDataset(dataset.wasmDatasetHandle)
  }
}

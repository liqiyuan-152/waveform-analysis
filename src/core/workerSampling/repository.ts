import type { WaveformPoint } from '@/types'
import type { WorkerSamplingDataset } from '../waveformPointSource'
import { javascriptSamplingBackend } from './javascriptBackend'
import {
  datasetLength,
  datasetVisibleRange,
  datasetXAt,
  datasetXRange,
  createStoredDataset,
  disposeDatasetIndexes,
  isWasmDatasetBackend,
  registerWasmDataset,
  type StoredDataset,
} from './repositoryDataset'
import {
  type DatasetResponse,
  type DisposeAllResponse,
  type FindNearestPointResponse,
  type SampleViewportResponse,
  type WorkerSamplingBackend,
  type WorkerSamplingBackendKind,
  type WorkerSamplingOutput,
  type WorkerSamplingRequest,
  type WorkerSamplingResponse,
  type WorkerSamplingSeriesRequest,
  type WorkerSamplingSeriesResponse,
  type WorkerSamplingStatus,
} from './protocol'
import { SamplingOutputCache, type SamplingCacheMetrics } from './samplingCache'
import {
  cacheKey,
  diagnosticsFor,
  nearestPoint,
  outputCount,
  outputWithGlobalIndexes,
  selectedStrategy,
  shouldUseRaw,
  statusFor,
  targetPointCount,
} from './repositorySupport'

export interface WorkerSamplingResourceMetrics {
  datasetCount: number
  indexBytes: number
  cache: SamplingCacheMetrics
}

export interface WorkerSamplingRepositoryOptions {
  javascriptBackend?: WorkerSamplingBackend
  wasmBackend?: WorkerSamplingBackend
  indexMaxBytes?: number
  cacheMaxEntries?: number
  cacheMaxBytes?: number
}

export class WorkerSamplingRepository {
  private readonly datasets = new Map<string, StoredDataset>()
  private readonly javascriptBackend: WorkerSamplingBackend
  private readonly cache: SamplingOutputCache
  private readonly indexMaxBytes: number | undefined
  private wasmBackend: WorkerSamplingBackend | undefined

  constructor(options: WorkerSamplingRepositoryOptions = {}) {
    this.javascriptBackend = options.javascriptBackend ?? javascriptSamplingBackend
    this.wasmBackend = options.wasmBackend
    this.indexMaxBytes = options.indexMaxBytes
    this.cache = new SamplingOutputCache({
      maxEntries: options.cacheMaxEntries,
      maxBytes: options.cacheMaxBytes,
    })
  }

  get resourceMetrics(): WorkerSamplingResourceMetrics {
    return {
      datasetCount: this.datasets.size,
      indexBytes: [...this.datasets.values()].reduce(
        (total, dataset) => total + (dataset.wasmIndexBytes ?? dataset.index?.byteLength ?? 0),
        0,
      ),
      cache: this.cache.metrics,
    }
  }

  /** Enables the numeric backend after the worker has initialized its WASM module. */
  setWasmBackend(backend: WorkerSamplingBackend | undefined) {
    if (
      this.wasmBackend &&
      this.wasmBackend !== backend &&
      isWasmDatasetBackend(this.wasmBackend)
    ) {
      this.wasmBackend.disposeAllDatasets()
      this.datasets.forEach((dataset) => {
        dataset.wasmDatasetHandle = undefined
        dataset.wasmIndexBytes = undefined
      })
    }
    this.wasmBackend = backend
    if (isWasmDatasetBackend(backend))
      this.datasets.forEach((dataset) => registerWasmDataset(backend, dataset, this.indexMaxBytes))
  }

  handle(request: WorkerSamplingRequest): WorkerSamplingResponse {
    switch (request.type) {
      case 'register-dataset':
        return this.register(request.datasetId, request.requestId, request.points, request.dataset)
      case 'replace-dataset':
        return this.replace(
          request.datasetId,
          request.requestId,
          request.revision,
          request.points,
          request.dataset,
        )
      case 'sample-viewport':
        return this.sample(request)
      case 'find-nearest-point':
        return this.findNearest(request.datasetId, request.requestId, request.revision, request.x)
      case 'get-dataset-metrics':
        return this.metrics(request.datasetId, request.requestId, request.revision)
      case 'dispose-dataset':
        return this.dispose(request.datasetId, request.requestId, request.revision)
      case 'dispose-all':
        return this.disposeAll(request.requestId)
    }
  }

  private register(
    datasetId: string,
    requestId: number,
    points: readonly WaveformPoint[] | undefined,
    dataset?: WorkerSamplingDataset,
  ): DatasetResponse {
    const existing = this.datasets.get(datasetId)
    if (existing) return this.datasetResponse(requestId, datasetId, existing, 'stale-revision')
    const stored = createStoredDataset(points, dataset, 1, this.indexMaxBytes)
    registerWasmDataset(this.wasmBackend, stored, this.indexMaxBytes)
    this.datasets.set(datasetId, stored)
    return this.datasetResponse(requestId, datasetId, stored, 'ok')
  }

  private replace(
    datasetId: string,
    requestId: number,
    revision: number,
    points: readonly WaveformPoint[] | undefined,
    numeric?: WorkerSamplingDataset,
  ): DatasetResponse {
    const existing = this.datasets.get(datasetId)
    const status = statusFor(existing, revision)
    if (status !== 'ok' || !existing)
      return this.datasetResponse(requestId, datasetId, existing, status)
    disposeDatasetIndexes(this.wasmBackend, existing)
    this.cache.deleteDataset(datasetId)
    const dataset = createStoredDataset(points, numeric, existing.revision + 1, this.indexMaxBytes)
    registerWasmDataset(this.wasmBackend, dataset, this.indexMaxBytes)
    this.datasets.set(datasetId, dataset)
    return this.datasetResponse(requestId, datasetId, dataset, 'ok')
  }

  private sample(
    request: Extract<WorkerSamplingRequest, { type: 'sample-viewport' }>,
  ): SampleViewportResponse {
    return {
      type: 'sample-viewport-response',
      requestId: request.requestId,
      results: request.series.map((series) => this.sampleSeries(request.requestId, series)),
    }
  }

  private sampleSeries(
    requestId: number,
    request: WorkerSamplingSeriesRequest,
  ): WorkerSamplingSeriesResponse {
    const startedAt = performance.now()
    const dataset = this.datasets.get(request.datasetId)
    const status = statusFor(dataset, request.revision)
    if (status !== 'ok' || !dataset) {
      return this.sampleResponse(
        requestId,
        request,
        status,
        undefined,
        'unavailable',
        'sampled',
        0,
        startedAt,
        false,
      )
    }
    const range = datasetVisibleRange(dataset, request.xDomain)
    const visiblePointCount = range.end - range.start
    if (shouldUseRaw(request, visiblePointCount)) {
      return this.sampleResponse(
        requestId,
        request,
        'ok',
        {
          kind: 'source-indexes',
          sourceIndexes: Uint32Array.from(
            { length: visiblePointCount },
            (_, index) => range.start + index,
          ),
        },
        'raw',
        'raw',
        visiblePointCount,
        startedAt,
        false,
      )
    }
    const preferredBackend =
      request.mode === 'wasm' || (request.mode === 'auto' && this.wasmBackend)
        ? this.wasmBackend
        : this.javascriptBackend
    const fallbackToJavascript = !preferredBackend && request.wasmFailureFallback === 'javascript'
    const backend = preferredBackend ?? (fallbackToJavascript ? this.javascriptBackend : undefined)
    if (!backend) {
      return this.sampleResponse(
        requestId,
        request,
        'wasm-unavailable',
        undefined,
        'unavailable',
        'sampled',
        visiblePointCount,
        startedAt,
        false,
      )
    }
    const strategy = selectedStrategy(request.strategy)
    const target = targetPointCount(request)
    const key = cacheKey(request, range, strategy, target, backend.kind)
    const cached = this.cache.get(key)
    if (cached) {
      return this.sampleResponse(
        requestId,
        request,
        fallbackToJavascript ? 'wasm-unavailable' : 'ok',
        cached,
        backend.kind,
        'sampled',
        visiblePointCount,
        startedAt,
        true,
      )
    }
    const indexed =
      backend.kind === 'wasm'
        ? dataset.wasmDatasetHandle !== undefined && isWasmDatasetBackend(backend)
          ? backend.sampleDataset(
              dataset.wasmDatasetHandle,
              range.start,
              range.end,
              strategy,
              target,
            )
          : undefined
        : dataset.index?.sample(range.start, range.end, strategy, target)
    const output =
      indexed ??
      outputWithGlobalIndexes(
        backend.sample({
          x: datasetXRange(dataset, range.start, range.end),
          y: dataset.y.subarray(range.start, range.end),
          points: dataset.points?.slice(range.start, range.end) ?? [],
          strategy,
          targetPointCount: target,
        }),
        range.start,
      )
    this.cache.set(key, output)
    if (dataset.wasmDatasetHandle !== undefined && isWasmDatasetBackend(backend)) {
      dataset.wasmIndexBytes = backend.datasetIndexBytes(dataset.wasmDatasetHandle)
    }
    return this.sampleResponse(
      requestId,
      request,
      fallbackToJavascript ? 'wasm-unavailable' : 'ok',
      output,
      backend.kind,
      'sampled',
      visiblePointCount,
      startedAt,
      false,
    )
  }

  private sampleResponse(
    requestId: number,
    request: WorkerSamplingSeriesRequest,
    status: WorkerSamplingStatus,
    output: WorkerSamplingOutput | undefined,
    backend: WorkerSamplingBackendKind,
    selectedMode: 'raw' | 'sampled',
    visiblePointCount: number,
    startedAt: number,
    cacheHit: boolean,
  ): WorkerSamplingSeriesResponse {
    const diagnostics = diagnosticsFor(
      request,
      datasetLength(this.datasets.get(request.datasetId)),
      visiblePointCount,
      backend,
      selectedMode,
      performance.now() - startedAt,
      outputCount(output),
      cacheHit,
    )
    diagnostics.requestId = requestId
    return {
      seriesId: request.seriesId,
      datasetId: request.datasetId,
      revision: request.revision,
      status,
      output,
      diagnostics,
    }
  }

  private findNearest(
    datasetId: string,
    requestId: number,
    revision: number,
    x: number,
  ): FindNearestPointResponse {
    const dataset = this.datasets.get(datasetId)
    const status = statusFor(dataset, revision)
    if (status !== 'ok' || !dataset) {
      return { type: 'find-nearest-point-response', requestId, datasetId, revision, status }
    }
    const point = dataset.points
      ? nearestPoint(dataset.points, x)
      : (() => {
          const range = datasetVisibleRange(dataset, [x, x])
          if (
            !datasetLength(dataset) ||
            x < datasetXAt(dataset, 0) ||
            x > datasetXAt(dataset, datasetLength(dataset) - 1)
          ) {
            return undefined
          }
          const right = Math.min(datasetLength(dataset) - 1, range.start)
          const left = Math.max(0, right - 1)
          const index =
            Math.abs(x - datasetXAt(dataset, left)) < Math.abs(datasetXAt(dataset, right) - x)
              ? left
              : right
          return Number.isFinite(x) && datasetLength(dataset)
            ? { x: datasetXAt(dataset, index), y: dataset.y[index]! }
            : undefined
        })()
    return { type: 'find-nearest-point-response', requestId, datasetId, revision, status, point }
  }

  private metrics(datasetId: string, requestId: number, revision: number): DatasetResponse {
    const dataset = this.datasets.get(datasetId)
    return this.datasetResponse(requestId, datasetId, dataset, statusFor(dataset, revision))
  }

  private dispose(datasetId: string, requestId: number, revision: number): DatasetResponse {
    const dataset = this.datasets.get(datasetId)
    const status = statusFor(dataset, revision)
    if (status === 'ok' && dataset) {
      disposeDatasetIndexes(this.wasmBackend, dataset)
      this.cache.deleteDataset(datasetId)
      this.datasets.delete(datasetId)
    }
    return this.datasetResponse(requestId, datasetId, dataset, status)
  }

  private disposeAll(requestId: number): DisposeAllResponse {
    const disposedDatasetIds = [...this.datasets.keys()]
    this.datasets.forEach((dataset) => disposeDatasetIndexes(this.wasmBackend, dataset))
    if (isWasmDatasetBackend(this.wasmBackend)) this.wasmBackend.disposeAllDatasets()
    this.datasets.clear()
    this.cache.clear()
    return { type: 'dispose-all-response', requestId, disposedDatasetIds }
  }

  private datasetResponse(
    requestId: number,
    datasetId: string,
    dataset: StoredDataset | undefined,
    status: WorkerSamplingStatus,
  ): DatasetResponse {
    return {
      type: 'dataset-response',
      requestId,
      datasetId,
      revision: dataset?.revision ?? 0,
      status,
      metrics: dataset
        ? {
            ...dataset.metrics,
            indexBytes: dataset.wasmIndexBytes ?? dataset.index?.byteLength ?? 0,
          }
        : undefined,
    }
  }
}

import type {
  WaveformPoint,
  WaveformLineType,
  WaveformPointType,
  WaveformSamplingBackend,
  WaveformSamplingDiagnostics,
  WaveformSamplingMode,
  WaveformSamplingStrategy,
} from '@/types'
import type { WorkerSamplingDataset } from '../waveformPointSource'

export const DEFAULT_WORKER_SAMPLING_AUTO_THRESHOLD = 1_000
export const DEFAULT_WORKER_SAMPLING_MAX_POINTS_PER_PIXEL = 4

export type WorkerSamplingBackendKind = WaveformSamplingBackend
export type WorkerSamplingStatus = 'ok' | 'stale-revision' | 'wasm-unavailable' | 'not-found'

export interface WorkerSamplingDatasetMetrics {
  inputPointCount: number
  validPointCount: number
  xDomain: [number, number] | null
  yDomain: [number, number] | null
  /** Current lazily-built multiresolution index allocation for this dataset. */
  indexBytes?: number
}

export interface WorkerSamplingSourceIndexes {
  kind: 'source-indexes'
  sourceIndexes: Uint32Array
}

export interface WorkerSamplingAggregates {
  kind: 'aggregates'
  x: Float64Array
  y: Float64Array
}

export type WorkerSamplingOutput = WorkerSamplingSourceIndexes | WorkerSamplingAggregates

export interface WorkerSamplingBackendRequest {
  x: Float64Array
  y: Float64Array
  /** Empty for compact datasets; retained for custom legacy backend compatibility. */
  points: readonly WaveformPoint[]
  strategy: Exclude<WaveformSamplingStrategy, 'auto'>
  targetPointCount: number
}

export interface WorkerSamplingBackend {
  readonly kind: Extract<WorkerSamplingBackendKind, 'javascript' | 'wasm'>
  sample(request: WorkerSamplingBackendRequest): WorkerSamplingOutput
}

export type WorkerSamplingDiagnostics = WaveformSamplingDiagnostics

export interface RegisterDatasetRequest {
  type: 'register-dataset'
  requestId: number
  datasetId: string
  revision: 0
  /** Legacy object points remain accepted for repository consumers. */
  points?: readonly WaveformPoint[]
  /** Compact numeric columns used by TypedArray chart inputs. */
  dataset?: WorkerSamplingDataset
}

export interface ReplaceDatasetRequest {
  type: 'replace-dataset'
  requestId: number
  datasetId: string
  revision: number
  points?: readonly WaveformPoint[]
  dataset?: WorkerSamplingDataset
}

export interface WorkerSamplingSeriesRequest {
  seriesId: string
  datasetId: string
  revision: number
  xDomain: [number, number]
  /** Optional main-thread hint; the Worker recomputes this from xDomain before sampling. */
  visibleStartIndex?: number
  /** Exclusive visible-range endpoint. */
  visibleEndIndex?: number
  plotWidth: number
  mode: WaveformSamplingMode
  autoThreshold?: number
  /** Interaction-only hysteresis. Omit previousSelectedMode after the interaction for exact bounds. */
  autoHysteresis?: number
  previousSelectedMode?: 'raw' | 'sampled'
  strategy: WaveformSamplingStrategy
  maxPointsPerPixel?: number
  maxPointCount?: number
  rawPointLimit?: number
  wasmFailureFallback?: 'error' | 'javascript'
  /** Rendering inputs that affect the cache key, even when only line geometry is overridden. */
  lineType?: WaveformLineType
  pointType?: WaveformPointType
  errorBarVisible?: boolean
  pointMinSpacing?: number
  errorBarMinSpacing?: number
}

export interface SampleViewportRequest {
  type: 'sample-viewport'
  requestId: number
  series: readonly WorkerSamplingSeriesRequest[]
}

export interface FindNearestPointRequest {
  type: 'find-nearest-point'
  requestId: number
  datasetId: string
  revision: number
  x: number
}

export interface GetDatasetMetricsRequest {
  type: 'get-dataset-metrics'
  requestId: number
  datasetId: string
  revision: number
}

export interface DisposeDatasetRequest {
  type: 'dispose-dataset'
  requestId: number
  datasetId: string
  revision: number
}

export interface DisposeAllRequest {
  type: 'dispose-all'
  requestId: number
}

export type WorkerSamplingRequest =
  | RegisterDatasetRequest
  | ReplaceDatasetRequest
  | SampleViewportRequest
  | FindNearestPointRequest
  | GetDatasetMetricsRequest
  | DisposeDatasetRequest
  | DisposeAllRequest

export interface DatasetResponse {
  type: 'dataset-response'
  requestId: number
  datasetId: string
  revision: number
  status: WorkerSamplingStatus
  metrics?: WorkerSamplingDatasetMetrics
}

export interface WorkerSamplingSeriesResponse {
  seriesId: string
  datasetId: string
  revision: number
  status: WorkerSamplingStatus
  output?: WorkerSamplingOutput
  diagnostics: WorkerSamplingDiagnostics
}

export interface SampleViewportResponse {
  type: 'sample-viewport-response'
  requestId: number
  results: readonly WorkerSamplingSeriesResponse[]
  /** Set by the worker when WASM initialization failed and a fallback was selected. */
  workerError?: string
}

export interface FindNearestPointResponse {
  type: 'find-nearest-point-response'
  requestId: number
  datasetId: string
  revision: number
  status: WorkerSamplingStatus
  point?: WaveformPoint
}

export interface DisposeAllResponse {
  type: 'dispose-all-response'
  requestId: number
  disposedDatasetIds: readonly string[]
}

export type WorkerSamplingResponse =
  DatasetResponse | SampleViewportResponse | FindNearestPointResponse | DisposeAllResponse

export interface WorkerSamplingResponseExpectation {
  requestId: number
  revisions: Readonly<Record<string, number>>
}

/** Rejects responses from an earlier request or an earlier data revision before UI state is updated. */
export function isCurrentWorkerSamplingResponse(
  response: WorkerSamplingResponse,
  expectation: WorkerSamplingResponseExpectation,
): boolean {
  if (response.requestId !== expectation.requestId) return false
  if (response.type === 'sample-viewport-response') {
    return response.results.every(
      (result) => expectation.revisions[result.datasetId] === result.revision,
    )
  }
  if (response.type === 'dispose-all-response') return true
  return expectation.revisions[response.datasetId] === response.revision
}

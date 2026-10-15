import type {
  WaveformAnnotation,
  WaveformInteractionMode,
  WaveformPanEndPayload,
  WaveformPoint,
  WaveformSamplingBackend,
  WaveformSamplingDiagnostics,
  WaveformSamplingError,
  WaveformZoomEndPayload,
  WaveformZoomIntentPayload,
  WaveformZoomResetPayload,
} from './chart'
import type {
  WaveformChartHandle,
  WaveformControlResult,
  WaveformControlState,
  WaveformControlTarget,
} from './controls'
import type { WaveformChartOptionUpdate } from './options'

/** Parameter tuples preserve the existing multi-argument Vue event protocol. */
export interface WaveformChartEvents {
  'update:interactionMode': [mode: WaveformInteractionMode]
  'interaction-mode-change': [mode: WaveformInteractionMode]
  'control-state-change': [state: WaveformControlState]
  'point-hover': [point: WaveformPoint | null]
  'zoom-intent': [payload: WaveformZoomIntentPayload]
  'zoom-change': [domain: [number, number]]
  'zoom-end': [payload: WaveformZoomEndPayload]
  'pan-end': [payload: WaveformPanEndPayload]
  'zoom-reset': [payload: WaveformZoomResetPayload]
  'update:annotations': [annotations: WaveformAnnotation[]]
  'update:hidden-series-ids': [ids: string[]]
  'series-visibility-change': [
    payload: { seriesId: string; visible: boolean; hiddenSeriesIds: string[] },
  ]
  'annotation-create': [annotation: WaveformAnnotation]
  'annotation-update': [annotation: WaveformAnnotation, previous: WaveformAnnotation]
  'annotation-delete': [annotation: WaveformAnnotation]
  'page-change': [page: number, pageCount: number]
  'sampling-complete': [diagnostics: WaveformSamplingDiagnostics]
  'sampling-backend-change': [
    payload: {
      seriesId: string
      previous: WaveformSamplingBackend
      current: WaveformSamplingBackend
    },
  ]
  'sampling-error': [error: WaveformSamplingError]
  rendered: [payload: { revision: number }]
  finished: [payload: { revision: number }]
}

export type WaveformChartEventHandler<K extends keyof WaveformChartEvents> = (
  ...args: WaveformChartEvents[K]
) => void

export type WaveformChartAction =
  | { type: 'zoom-in' | 'zoom-out' | 'fit' | 'reset'; target?: WaveformControlTarget }
  | { type: 'set-domain'; domain: [number, number]; target?: WaveformControlTarget }
  | { type: 'set-mode'; mode: WaveformInteractionMode }

export type WaveformChartErrorCode = 'invalid-container' | 'invalid-option' | 'instance-disposed'

/** The native factory returns this interface; no public class constructor bypasses registration. */
export interface WaveformChartInstance extends WaveformChartHandle {
  setOption(options: WaveformChartOptionUpdate): void
  resize(): void
  dispatchAction(action: WaveformChartAction): WaveformControlResult
  on<K extends keyof WaveformChartEvents>(
    event: K,
    handler: WaveformChartEventHandler<K>,
  ): () => void
  off<K extends keyof WaveformChartEvents>(event: K, handler?: WaveformChartEventHandler<K>): void
  dispose(): void
  isDisposed(): boolean
}

import type { WaveformControlState } from '../../types/controls'
import type {
  WaveformAnnotation,
  WaveformInteractionMode,
  WaveformPoint,
  WaveformSamplingBackend,
  WaveformSamplingDiagnostics,
  WaveformSamplingError,
  WaveformZoomIntentPayload,
  WaveformZoomEndPayload,
  WaveformPanEndPayload,
  WaveformZoomResetPayload,
} from '../data/types'

export type { WaveformChartProps } from '../../types/options'

export type { ResolvedWaveformChartProps } from '../../types/options'

export interface WaveformChartEmit {
  (event: 'update:interactionMode', mode: WaveformInteractionMode): void
  (event: 'interaction-mode-change', mode: WaveformInteractionMode): void
  (event: 'control-state-change', state: WaveformControlState): void
  (event: 'point-hover', point: WaveformPoint | null): void
  (event: 'zoom-intent', payload: WaveformZoomIntentPayload): void
  (event: 'zoom-change', domain: [number, number]): void
  (event: 'zoom-end', payload: WaveformZoomEndPayload): void
  (event: 'pan-end', payload: WaveformPanEndPayload): void
  (event: 'zoom-reset', payload: WaveformZoomResetPayload): void
  (event: 'update:annotations', annotations: WaveformAnnotation[]): void
  (event: 'update:hidden-series-ids', ids: string[]): void
  (
    event: 'series-visibility-change',
    payload: { seriesId: string; visible: boolean; hiddenSeriesIds: string[] },
  ): void
  (event: 'annotation-create', annotation: WaveformAnnotation): void
  (event: 'annotation-update', annotation: WaveformAnnotation, previous: WaveformAnnotation): void
  (event: 'annotation-delete', annotation: WaveformAnnotation): void
  (event: 'page-change', page: number, pageCount: number): void
  (event: 'sampling-complete', diagnostics: WaveformSamplingDiagnostics): void
  (
    event: 'sampling-backend-change',
    payload: {
      seriesId: string
      previous: WaveformSamplingBackend
      current: WaveformSamplingBackend
    },
  ): void
  (event: 'sampling-error', error: WaveformSamplingError): void
}

interface ViewportSelectionBase {
  trackIndex: number
  independent: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
  pointerId: number
  xDomain: [number, number]
  yDomains: Record<string, [number, number]>
}

export type ViewportSelectionState =
  (ViewportSelectionBase & { kind: 'box' }) | (ViewportSelectionBase & { kind: 'pan' })

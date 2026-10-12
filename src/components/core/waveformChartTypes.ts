import type { WaveformToolbarOptions, WaveformControlState } from '../../types/controls'
import type {
  WaveformAnnotation,
  WaveformAxesOptions,
  WaveformData,
  WaveformDisplayMode,
  WaveformUnitDisplayMode,
  WaveformLayoutPreset,
  WaveformFrameStyle,
  WaveformInteractionMode,
  WaveformLegendOptions,
  WaveformOverlayMode,
  WaveformPlotMargin,
  WaveformPoint,
  WaveformRenderingOptions,
  WaveformSamplingBackend,
  WaveformSamplingDiagnostics,
  WaveformSamplingError,
  WaveformTitleOptions,
  WaveformXDomainStrategy,
  WaveformZeroLineOptions,
  WaveformZoomIntentPayload,
  WaveformZoomEndPayload,
  WaveformPanEndPayload,
  WaveformZoomResetPayload,
} from '../data/types'
import type { WaveformGridOptions } from './grid'

export interface WaveformChartProps {
  toolbar?: boolean | WaveformToolbarOptions
  data: WaveformData
  displayMode?: WaveformDisplayMode
  overlayMode?: WaveformOverlayMode
  /** Default axis units; optional chart-wide single-series legend units. */
  unitDisplayMode?: WaveformUnitDisplayMode
  /** Default spacing or compact title/time labels with a separate pagination band. */
  layoutPreset?: WaveformLayoutPreset
  width?: number
  height?: number
  xLabel?: string
  yLabel?: string
  lineColor?: string
  showTooltip?: boolean
  zoomable?: boolean
  /** Snap viewport endpoints outwards to integer X-axis display units. */
  integerZoom?: boolean
  pannable?: boolean
  /** Global record bounds in seconds; enables horizontal panning beyond loaded data. */
  panXDomain?: [number, number]
  minZoomSpan?: number
  minVisiblePoints?: number
  maxZoomScale?: number | null
  initialXDomain?: [number, number]
  initialXDomains?: Record<string, [number, number]>
  xDomainStrategy?: WaveformXDomainStrategy
  yDomain?: [number, number]
  yDomains?: Record<string, [number, number]>
  timeUnit?: 's' | 'ms'
  frameNumber?: string | number
  /** Per-track frame watermark overrides, keyed by stable trackId. */
  frameNumbers?: Record<string, string | number>
  frameStyle?: WaveformFrameStyle
  axes?: WaveformAxesOptions
  annotations?: WaveformAnnotation[]
  annotationsVisible?: boolean
  interactionMode?: WaveformInteractionMode
  grid?: WaveformGridOptions
  rendering?: WaveformRenderingOptions
  plotMargin?: WaveformPlotMargin
  title?: WaveformTitleOptions
  legend?: WaveformLegendOptions
  hiddenSeriesIds?: string[]
  defaultHiddenSeriesIds?: string[]
  cleanView?: boolean
  presentationMode?: boolean
  zeroLine?: WaveformZeroLineOptions
}

type DefaultedProp =
  | 'displayMode'
  | 'overlayMode'
  | 'unitDisplayMode'
  | 'layoutPreset'
  | 'yLabel'
  | 'lineColor'
  | 'showTooltip'
  | 'zoomable'
  | 'integerZoom'
  | 'pannable'
  | 'minVisiblePoints'
  | 'xDomainStrategy'
  | 'timeUnit'
  | 'annotations'
  | 'annotationsVisible'
  | 'grid'
  | 'rendering'
  | 'plotMargin'
  | 'legend'
  | 'defaultHiddenSeriesIds'
  | 'cleanView'
  | 'presentationMode'
  | 'zeroLine'

export type ResolvedWaveformChartProps = Readonly<
  WaveformChartProps & Required<Pick<WaveformChartProps, DefaultedProp>>
>

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

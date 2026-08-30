import type {
  WaveformAnnotation,
  WaveformAxesOptions,
  WaveformData,
  WaveformDisplayMode,
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
  WaveformZoomEndPayload,
  WaveformZoomResetPayload,
} from '../data/types'
import type { WaveformGridOptions } from './grid'

export interface WaveformChartProps {
  data: WaveformData
  displayMode?: WaveformDisplayMode
  overlayMode?: WaveformOverlayMode
  width?: number
  height?: number
  xLabel?: string
  yLabel?: string
  lineColor?: string
  showTooltip?: boolean
  zoomable?: boolean
  pannable?: boolean
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
  | 'yLabel'
  | 'lineColor'
  | 'showTooltip'
  | 'zoomable'
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
  (event: 'point-hover', point: WaveformPoint | null): void
  (event: 'zoom-change', domain: [number, number]): void
  (event: 'zoom-end', payload: WaveformZoomEndPayload): void
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

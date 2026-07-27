import type {
  WaveformAnnotation,
  WaveformAxesOptions,
  WaveformData,
  WaveformDisplayMode,
  WaveformFrameStyle,
  WaveformInteractionMode,
  WaveformLegendOptions,
  WaveformOverlayMode,
  WaveformPoint,
  WaveformRenderingOptions,
  WaveformTitleOptions,
  WaveformZeroLineOptions,
  WaveformZoomEndPayload,
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
  initialXDomain?: [number, number]
  initialXDomains?: Record<string, [number, number]>
  timeUnit?: 's' | 'ms'
  frameNumber?: string | number
  frameStyle?: WaveformFrameStyle
  axes?: WaveformAxesOptions
  annotations?: WaveformAnnotation[]
  annotationsVisible?: boolean
  interactionMode?: WaveformInteractionMode
  grid?: WaveformGridOptions
  rendering?: WaveformRenderingOptions
  title?: WaveformTitleOptions
  legend?: WaveformLegendOptions
  hiddenSeriesIds?: string[]
  defaultHiddenSeriesIds?: string[]
  cleanView?: boolean
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
  | 'timeUnit'
  | 'annotations'
  | 'annotationsVisible'
  | 'grid'
  | 'rendering'
  | 'legend'
  | 'defaultHiddenSeriesIds'
  | 'cleanView'
  | 'zeroLine'

export type ResolvedWaveformChartProps = Readonly<
  WaveformChartProps & Required<Pick<WaveformChartProps, DefaultedProp>>
>

export interface WaveformChartEmit {
  (event: 'point-hover', point: WaveformPoint | null): void
  (event: 'zoom-change', domain: [number, number]): void
  (event: 'zoom-end', payload: WaveformZoomEndPayload): void
  (event: 'zoom-reset'): void
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
}

export interface ViewportSelectionState {
  trackIndex: number
  independent: boolean
  overlay: SVGRectElement
  startX: number
  startY: number
  currentX: number
  currentY: number
  pointerId: number
  mode: 'box' | 'pan'
  xDomain: [number, number]
  yDomains: Record<string, [number, number]>
}

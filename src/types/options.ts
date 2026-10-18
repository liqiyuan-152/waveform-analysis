import type { ControlTheme } from '../controls/theme'
import type { WaveformAnimationProps } from '../animation/types'
import type { WaveformToolbarOptions } from './controls'
import type {
  WaveformAmplitudeLimits,
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
  WaveformRenderingOptions,
  WaveformTitleOptions,
  WaveformXDomainStrategy,
  WaveformZeroLineOptions,
} from './index'
import type { WaveformGridOptions } from '../components/core/grid'

export interface WaveformChartProps extends WaveformAnimationProps {
  controlTheme?: ControlTheme
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
  /** Point diameter in CSS pixels (equal-area circle for other shapes). Defaults to 2. */
  pointSize?: number
  showTooltip?: boolean
  zoomable?: boolean
  /** Prefer integer display-unit endpoints; preserve any window narrower than one unit. */
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
  /** Strict bounds per normalized series ID; active bounds override Y viewports. */
  amplitudeLimits?: WaveformAmplitudeLimits
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

/** Framework-independent creation options; an omitted data source starts empty. */
export type WaveformChartOptions = Omit<WaveformChartProps, 'data'> & { data?: WaveformData }

export type WaveformChartOptionUpdate = Partial<WaveformChartProps>

export interface WaveformChartInitOptions {
  autoResize?: boolean
}

type DefaultedProp =
  | 'displayMode'
  | 'overlayMode'
  | 'unitDisplayMode'
  | 'layoutPreset'
  | 'yLabel'
  | 'lineColor'
  | 'pointSize'
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

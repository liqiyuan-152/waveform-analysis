import type { ScaleLinear } from 'd3'
import type {
  ResolvedWaveformErrorBarOptions,
  WaveformLineType,
  WaveformLineStyle,
  WaveformPoint,
  WaveformPointType,
} from '../../types'
import type { NormalizedWaveformGridLineOptions } from './grid'

/**
 * 显示系列
 */
export interface DisplaySeries {
  id: string
  trackId?: string
  name: string
  unit?: string
  color: string
  lineType: WaveformLineType
  lineStyle: WaveformLineStyle
  pointType: WaveformPointType
  errorBar: ResolvedWaveformErrorBarOptions
  points: WaveformPoint[]
  xDomain: [number, number]
  yDomain: [number, number]
  hasErrorPoints: boolean
}

export interface DisplayTrack {
  id: string
  /** Complete series list retained for legend rendering and visibility restoration. */
  series: DisplaySeries[]
  /** Series currently participating in layout, rendering, and interaction. */
  visibleSeries: DisplaySeries[]
  xDomain: [number, number]
  yDomain: [number, number]
}

export interface TrackSeriesPath {
  series: DisplaySeries
  path: string | null
  pointRenderPoints: WaveformPoint[]
  errorBarRenderPoints: WaveformPoint[]
  yScale: ScaleLinear<number, number>
  yAxisIndex: number
}

export interface WaveformYAxisLayout {
  index: number
  side: 'left' | 'right'
  x: number
  labelX: number
  scale: ScaleLinear<number, number>
  majorTicks: number[]
  minorTicks: number[]
  tickValues: number[]
  seriesList: DisplaySeries[]
}

/**
 * 悬浮的系列点
 */
export interface HoveredSeriesPoint {
  id: string
  name: string
  unit?: string
  color: string
  trackIndex: number
  point: WaveformPoint
}

export interface WaveformHoverState {
  points: HoveredSeriesPoint[]
  trackIndex: number | null
  position: { x: number; y: number }
}

/**
 * 轨道布局
 */
export interface TrackLayout {
  /** Stable track key derived from trackId, or from the series id when trackId is omitted. */
  id: string
  index: number
  series: DisplaySeries
  /** Visible series used by rendering and interaction code. */
  seriesList: DisplaySeries[]
  /** Complete series list used by the legend. */
  legendSeries: DisplaySeries[]
  isEmpty: boolean
  hasVisibleSeries: boolean
  column: number
  showYAxisLabel: boolean
  yAxisLabelX: number
  left: number
  top: number
  width: number
  height: number
  xScale: ScaleLinear<number, number>
  yScale: ScaleLinear<number, number>
  yAxes: WaveformYAxisLayout[]
  xMajorTicks: number[]
  xMinorTicks: number[]
  yMajorTicks: number[]
  yMinorTicks: number[]
  yAxisTickValues: number[]
  xAxisTickValues: number[]
  endpointLabels: { start: string; end: string }
  path: string | null
  seriesPaths: TrackSeriesPath[]
  showXAxis: boolean
  gridLines: NormalizedWaveformGridLineOptions
}

// 重新导出 WaveformPoint 方便使用
export type { WaveformPoint }

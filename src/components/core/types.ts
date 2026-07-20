import type { ScaleLinear } from 'd3'
import type { WaveformPoint } from '../../types'

/**
 * 显示系列
 */
export interface DisplaySeries {
  id: string
  trackId?: string
  name: string
  unit?: string
  color: string
  points: WaveformPoint[]
  xDomain: [number, number]
  yDomain: [number, number]
}

export interface DisplayTrack {
  id: string
  series: DisplaySeries[]
  xDomain: [number, number]
  yDomain: [number, number]
}

export interface TrackSeriesPath {
  series: DisplaySeries
  path: string | null
  yScale: ScaleLinear<number, number>
  yAxisIndex: number
}

export interface WaveformYAxisLayout {
  index: number
  side: 'left' | 'right'
  x: number
  labelX: number
  exponentX: number
  exponentLabel: string | null
  scale: ScaleLinear<number, number>
  majorTicks: number[]
  minorTicks: number[]
  tickValues: number[]
  seriesList: DisplaySeries[]
}

/**
 * 悬浮的系列点
 */
export interface HoveredSeriesPoint extends DisplaySeries {
  trackIndex: number
  point: WaveformPoint
}

/**
 * 轨道布局
 */
export interface TrackLayout {
  index: number
  series: DisplaySeries
  seriesList: DisplaySeries[]
  isEmpty: boolean
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
  xAxisExponent: string | null
  path: string | null
  seriesPaths: TrackSeriesPath[]
  showXAxis: boolean
}

// 重新导出 WaveformPoint 方便使用
export type { WaveformPoint }

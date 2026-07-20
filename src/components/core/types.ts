import type { ScaleLinear } from 'd3'
import type { WaveformPoint } from '../../types'

/**
 * 显示系列
 */
export interface DisplaySeries {
  id: string
  name: string
  unit?: string
  color: string
  points: WaveformPoint[]
  xDomain: [number, number]
  yDomain: [number, number]
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
  column: number
  showYAxisLabel: boolean
  yAxisLabelX: number
  left: number
  top: number
  width: number
  height: number
  xScale: ScaleLinear<number, number>
  yScale: ScaleLinear<number, number>
  xMajorTicks: number[]
  xMinorTicks: number[]
  yMajorTicks: number[]
  yMinorTicks: number[]
  yAxisTickValues: number[]
  xAxisTickValues: number[]
  endpointLabels: { start: string; end: string }
  path: string | null
  showXAxis: boolean
}

// 重新导出 WaveformPoint 方便使用
export type { WaveformPoint }

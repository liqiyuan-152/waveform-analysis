export interface WaveformPoint {
  id?: string
  x: number
  y: number
}

export type WaveformLineType = 'linear' | 'step-start' | 'step-middle' | 'step-end'
export type WaveformLineStyle = 'solid' | 'dashed' | 'dash-dot'
export type WaveformPointType = 'circle' | 'square' | 'triangle' | 'diamond'

export interface WaveformSeriesPointStyle {
  visible?: boolean
  type?: WaveformPointType
  size?: number
  color?: string
  borderColor?: string
  borderWidth?: number
}

export interface WaveformSeriesStyle {
  color?: string
  lineWidth?: number
  lineType?: WaveformLineType
  lineStyle?: WaveformLineStyle
  opacity?: number
  point?: WaveformSeriesPointStyle
}

export interface WaveformSeries {
  id?: string
  name?: string
  shot?: string | number
  unit?: string
  order?: number
  yAxis?: string
  data: WaveformPoint[]
  style?: WaveformSeriesStyle
}

export type WaveformData = WaveformPoint[] | WaveformSeries[]

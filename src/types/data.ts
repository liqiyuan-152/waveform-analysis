import type { WaveformPoint } from './chart'

export type WaveformLineType =
  | 'none'
  | 'linear'
  | 'step-start'
  | 'step-middle'
  | 'step-end'
  /** Backward-compatible alias for `step-end`. */
  | 'step-after'

export type WaveformLineStyle = 'solid' | 'dashed' | 'dash-dot'

export type WaveformPointType = 'none' | 'circle' | 'square' | 'triangle' | 'diamond'

export interface WaveformErrorBarOptions {
  visible?: boolean
  color?: string
  width?: number
  capWidth?: number
}

export interface ResolvedWaveformErrorBarOptions {
  visible: boolean
  color?: string
  width: number
  capWidth: number
}

/**
 * 单波形数据格式（采样点或显式坐标点）
 */
export type SingleWaveformData =
  | {
      kind: 'samples'
      values: number[]
      sampleRate: number
      startTime?: number
    }
  | {
      kind: 'points'
      points: WaveformPoint[]
    }

/**
 * 波形系列
 */
export interface WaveformSeries {
  id?: string
  /** 相同 trackId 的系列叠加在同一图框中；默认每个系列独占一个图框。 */
  trackId?: string
  name: string
  unit?: string
  color?: string
  lineType?: WaveformLineType
  lineStyle?: WaveformLineStyle
  pointType?: WaveformPointType
  errorBar?: WaveformErrorBarOptions
  data: SingleWaveformData
}

/**
 * 波形数据（单波形或多通道）
 */
export type WaveformData =
  | SingleWaveformData
  | {
      kind: 'series'
      series: WaveformSeries[]
    }

/**
 * 规范化后的波形系列
 */
export interface NormalizedWaveformSeries {
  id: string
  trackId?: string
  name: string
  unit?: string
  color?: string
  lineType: WaveformLineType
  lineStyle: WaveformLineStyle
  pointType: WaveformPointType
  errorBar: ResolvedWaveformErrorBarOptions
  points: WaveformPoint[]
}

import type { WaveformPoint } from './chart'

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
  name: string
  unit?: string
  color?: string
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
  name: string
  unit?: string
  color?: string
  points: WaveformPoint[]
}

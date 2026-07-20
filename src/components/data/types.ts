/**
 * 数据系统类型定义
 * 重新导出 src/types 中的类型，方便组件内部使用
 */

// 重新导出所有类型
export type {
  WaveformPoint,
  WaveformDisplayMode,
  WaveformOverlayMode,
  WaveformInteractionMode,
  WaveformAnnotationStyle,
  WaveformAnnotation,
  WaveformRenderingOptions,
  WaveformTitleTextStyle,
  WaveformTitleOptions,
  WaveformLegendPosition,
  WaveformLegendOrientation,
  WaveformLegendOptions,
  WaveformFrameStyle,
  SingleWaveformData,
  WaveformLineType,
  WaveformPointType,
  WaveformErrorBarOptions,
  ResolvedWaveformErrorBarOptions,
  WaveformSeries,
  WaveformData,
  NormalizedWaveformSeries,
} from '../../types'

export type { WaveformGridOptions } from '../core/grid'

// 重新导出数据处理函数
export { normalizeWaveformData, normalizeWaveformSeries } from '../../core'

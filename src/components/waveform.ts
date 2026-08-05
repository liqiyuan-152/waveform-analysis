/**
 * 向后兼容的导出文件
 * 保留原有导入路径，内部从新的模块结构导出
 */

// 类型定义
export type {
  WaveformPoint,
  WaveformDisplayMode,
  WaveformOverlayMode,
  WaveformInteractionMode,
  WaveformAnnotationStyle,
  WaveformAnnotation,
  WaveformRenderingOptions,
  WaveformPlotMargin,
  WaveformTitleTextStyle,
  WaveformTitleOptions,
  WaveformFrameStyle,
  SingleWaveformData,
  WaveformSeries,
  WaveformLineStyle,
  WaveformData,
  NormalizedWaveformSeries,
} from '../types'

// 数据处理函数
export { normalizeWaveformData, normalizeWaveformSeries } from '../core'

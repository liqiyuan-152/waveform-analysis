export { default as WaveformChart } from './WaveformChart.vue'

// 从新的系统目录导出类型，保持向后兼容
export type {
  SingleWaveformData,
  WaveformData,
  WaveformDisplayMode,
  WaveformOverlayMode,
  WaveformInteractionMode,
  WaveformZoomEndPayload,
  WaveformAnnotationStyle,
  WaveformAnnotation,
  WaveformRenderingOptions,
  WaveformTitleTextStyle,
  WaveformTitleOptions,
  WaveformLegendPosition,
  WaveformLegendOrientation,
  WaveformLegendOptions,
  WaveformFrameStyle,
  WaveformZeroLineOptions,
  WaveformPoint,
  WaveformSeries,
  WaveformLineType,
  WaveformPointType,
  WaveformErrorBarOptions,
  WaveformGridOptions,
  WaveformGridLineOptions,
  WaveformGridTrackLines,
} from './data/types'

export type { WaveformGridOptions as WaveformGridConfig } from './core/grid'

// 可选：导出各系统的组件（供高级用户使用）
export { WaveformTooltip } from './interaction'
export { WaveformTrack } from './rendering'
export { WaveformAnnotationLayer, WaveformAnnotationContextMenu } from './annotation'

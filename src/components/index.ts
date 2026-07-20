export { default as WaveformChart } from './WaveformChart.vue'

// 从新的系统目录导出类型，保持向后兼容
export type {
  SingleWaveformData,
  WaveformData,
  WaveformDisplayMode,
  WaveformInteractionMode,
  WaveformAnnotationStyle,
  WaveformAnnotation,
  WaveformRenderingOptions,
  WaveformPoint,
  WaveformSeries,
  WaveformGridOptions,
} from './data/types'

export type { WaveformGridOptions as WaveformGridConfig } from './core/grid'

// 可选：导出各系统的组件（供高级用户使用）
export { WaveformTooltip } from './interaction'
export { WaveformTrack } from './rendering'
export {
  WaveformAnnotationLayer,
  WaveformAnnotationToolbar,
  WaveformAnnotationContextMenu,
} from './annotation'

/**
 * 波形分析组件库主入口
 * @packageDocumentation
 */

// Vue 组件
export { default as WaveformChart } from './components/WaveformChart.vue'

// 类型定义
export type {
  // 图表类型
  WaveformPoint,
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
  // 数据类型
  SingleWaveformData,
  WaveformLineType,
  WaveformPointType,
  WaveformErrorBarOptions,
  ResolvedWaveformErrorBarOptions,
  WaveformSeries,
  WaveformData,
  NormalizedWaveformSeries,
} from './types'

export type { WaveformGridOptions } from './components/core/grid'

// 核心功能
export { normalizeWaveformData, normalizeWaveformSeries } from './core'

// 工具函数
export {
  paddedDomain,
  buildMinorTicks,
  displayTime,
  formatEndpointTime,
  formatAxisTime,
  formatTooltipTime,
  resolveTrackGeometry,
  clamp,
  type TimeUnit,
  type TrackGeometry,
} from './utils'

export {
  DEFAULT_WAVEFORM_RENDERING_OPTIONS,
  resolveWaveformRenderingOptions,
  selectRenderablePoints,
  type ResolvedWaveformRenderingOptions,
} from './core'

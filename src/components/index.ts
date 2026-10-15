export { default as WaveformChart } from './WaveformChart.vue'

// 从新的系统目录导出类型，保持向后兼容
export type {
  SingleWaveformData,
  WaveformData,
  WaveformDisplayMode,
  WaveformOverlayMode,
  WaveformInteractionMode,
  WaveformZoomIntentPayload,
  WaveformZoomEndPayload,
  WaveformAnnotationStyle,
  WaveformAnnotation,
  WaveformRenderingOptions,
  WaveformPlotMargin,
  WaveformTitleTextStyle,
  WaveformTitleOptions,
  WaveformLegendPosition,
  WaveformLegendOrientation,
  WaveformLegendOptions,
  WaveformFrameStyle,
  WaveformAxesOptions,
  WaveformZeroLineOptions,
  WaveformPoint,
  WaveformSeries,
  WaveformLineType,
  WaveformLineStyle,
  WaveformPointType,
  WaveformErrorBarOptions,
  WaveformGridOptions,
  WaveformGridLineOptions,
  WaveformGridTrackLines,
} from './data/types'

export type { WaveformGridOptions as WaveformGridConfig } from './core/grid'

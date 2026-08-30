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
  WaveformXDomainStrategy,
  WaveformZoomEndPayload,
  WaveformZoomResetPayload,
  WaveformAnnotationStyle,
  WaveformAnnotation,
  WaveformSamplingMode,
  WaveformSamplingStrategy,
  WaveformSamplingOptions,
  WaveformSamplingBackend,
  WaveformSamplingDiagnostics,
  WaveformSamplingError,
  WaveformRenderingOptions,
  WaveformPlotMargin,
  WaveformTitleTextStyle,
  WaveformTitleOptions,
  WaveformLegendPosition,
  WaveformLegendOrientation,
  WaveformLegendOptions,
  WaveformFrameStyle,
  WaveformXAxisLabelKind,
  WaveformXAxisLabelFormatterContext,
  WaveformXAxisLabelFormatter,
  WaveformAxesOptions,
  WaveformZeroLineOptions,
  // 数据类型
  SingleWaveformData,
  WaveformLineType,
  WaveformLineStyle,
  WaveformPointType,
  WaveformErrorBarOptions,
  ResolvedWaveformErrorBarOptions,
  WaveformTypedValues,
  TypedSampleData,
  TypedPointData,
  WaveformSeries,
  WaveformData,
  NormalizedWaveformSeries,
} from './types'

export type {
  WaveformGridOptions,
  WaveformGridLineOptions,
  WaveformGridTrackLines,
} from './components/core/grid'

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
  calculateWasmRange,
  findWasmVisibleRange,
  DEFAULT_WAVEFORM_RENDERING_OPTIONS,
  resolveWaveformRenderingOptions,
  selectRenderablePoints,
  type ResolvedWaveformRenderingOptions,
  type ResolvedWaveformSamplingOptions,
  type WasmRangeMetrics,
  initializeWasmSampling,
  sampleWaveformWasm,
  type WasmSamplingRequest,
  type WasmSamplingResult,
  type WasmSamplingStrategy,
} from './core'

export { parseWaveformAnnotations, serializeWaveformAnnotations } from './components/annotation'

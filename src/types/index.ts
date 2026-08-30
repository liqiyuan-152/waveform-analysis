/**
 * 类型定义统一导出
 */

// 图表类型
export type {
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
} from './chart'

// 数据类型
export type {
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
} from './data'

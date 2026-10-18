/**
 * 波形分析组件库主入口
 * @packageDocumentation
 */

// Framework-independent algorithms and public integration contracts.
/** Chart props include the global CSS-pixel pointSize (default 2). */
export type { WaveformChartProps } from './analysis'

// Numeric engine, pure preset factories and owner-scoped chart animation.
export { getEasingFunction } from './analysis'
export { WaveformAnimationController } from './analysis'
export { createLineDrawingAnimation, createStaggeredLineDrawingAnimations } from './analysis'
export { createPathTransitionAnimation, createYAxisScaleAnimation } from './analysis'
export { createAnnotationAppearAnimation, createAnnotationDisappearAnimation } from './analysis'
export { Animation } from './analysis'
export { Animator, globalAnimator } from './analysis'
export type {
  AnimationValue,
  AnimationDirection,
  AnimationState,
  AnimationFrame,
  AnimationTrack,
  AnimationConfig,
  AnimationHandle,
  AnimationScheduler,
  EasingFunction,
  EasingFamily,
  EasingType,
} from './analysis'
export type {
  LineDrawingDirection,
  AnnotationAnimationType,
  LineDrawingOptions,
  StaggeredLineDrawingOptions,
  DataUpdateOptions,
  AnnotationAnimationOptions,
  WaveformEnterAnimationOptions,
  WaveformUpdateAnimationOptions,
  WaveformAnnotationAnimationOptions,
  WaveformAnimationProps,
  ClipAnimationState,
  AnimationBinding,
  NumericGeometry,
  GeometryTransitionInput,
  GeometryTransitionFrame,
  AnnotationAnimationState,
  AnimationScope,
  AnimationObjectKey,
  WaveformAnimationControllerOptions,
} from './analysis'

// 类型定义
export type {
  // 图表类型
  WaveformAmplitudeLimit,
  WaveformAmplitudeLimits,
  WaveformPoint,
  WaveformDisplayMode,
  WaveformUnitDisplayMode,
  WaveformLayoutPreset,
  WaveformOverlayMode,
  WaveformInteractionMode,
  WaveformXDomainStrategy,
  WaveformZoomIntentPayload,
  WaveformZoomEndPayload,
  WaveformPanEndPayload,
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
  // Explicit axes.y padding ratios preserve exact bounds with nice ticks.
  // Includes axes.y.maximumTickVisible and minimumTickVisible for independent extrema ticks.
  WaveformAxesOptions, // Includes axes.x.splitNumber for the target X-axis segment count.
  WaveformYAxisLabelTextStyle,
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
} from './analysis'

export type {
  WaveformGridOptions,
  WaveformGridLineOptions,
  WaveformGridTrackLines,
} from './analysis'

// 核心功能
export { normalizeWaveformData, normalizeWaveformSeries } from './analysis'

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
} from './analysis'

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
} from './analysis'

export { parseWaveformAnnotations, serializeWaveformAnnotations } from './analysis'

export type {
  WaveformToolbarItem,
  WaveformToolbarOptions,
  WaveformControlTarget,
  WaveformControlAction,
  WaveformCommandMetadata,
  WaveformTargetStatus,
  WaveformViewportSnapshot,
  WaveformTargetResult,
  WaveformControlResult,
  WaveformControlState,
  WaveformImageExportOptions,
  WaveformImageExportErrorCode,
  WaveformImageExportError,
  WaveformChartHandle,
} from './analysis'

export type {
  WaveformChartOptions,
  WaveformChartOptionUpdate,
  WaveformChartInitOptions,
} from './analysis'
export type {
  WaveformChartEvents,
  WaveformChartEventHandler,
  WaveformChartAction,
  WaveformChartInstance,
  WaveformChartErrorCode,
} from './analysis'
export { init, getInstanceByDom, dispose } from './analysis'

export { Waveform, defaultOptions as waveformDisplayDefaultOptions } from './display'
export type {
  WaveformPoint as WaveformDisplayPoint,
  WaveformLineType as WaveformDisplayLineType,
  WaveformLineStyle as WaveformDisplayLineStyle,
  WaveformPointType as WaveformDisplayPointType,
  WaveformSeriesPointStyle as WaveformDisplaySeriesPointStyle,
  WaveformSeriesStyle as WaveformDisplaySeriesStyle,
  WaveformSeries as WaveformDisplaySeries,
  WaveformData as WaveformDisplayData,
  BorderStyle as WaveformDisplayBorderStyle,
  GridLineStyle as WaveformDisplayGridLineStyle,
  PaddingOptions as WaveformDisplayPaddingOptions,
  FrameOptions as WaveformDisplayFrameOptions,
  FrameNumberStyleOptions as WaveformDisplayFrameNumberStyleOptions,
  LineOptions as WaveformDisplayLineOptions,
  PointOptions as WaveformDisplayPointOptions,
  AxisLabelOptions as WaveformDisplayAxisLabelOptions,
  AxisOptions as WaveformDisplayAxisOptions,
  XAxisOptions as WaveformDisplayXAxisOptions,
  ValueAxisOptions as WaveformDisplayValueAxisOptions,
  GridAxisOptions as WaveformDisplayGridAxisOptions,
  ValueGridAxisOptions as WaveformDisplayValueGridAxisOptions,
  GridOptions as WaveformDisplayGridOptions,
  ZeroLineOptions as WaveformDisplayZeroLineOptions,
  TitleOptions as WaveformDisplayTitleOptions,
  ShotOptions as WaveformDisplayShotOptions,
  ResponsiveOptions as WaveformDisplayResponsiveOptions,
  LegendOptions as WaveformDisplayLegendOptions,
  EmptyStateOptions as WaveformDisplayEmptyStateOptions,
  HorizontalPadding as WaveformDisplayHorizontalPadding,
  LayoutOptions as WaveformDisplayLayoutOptions,
  WaveformLayoutChange as WaveformDisplayLayoutChange,
  XDomainStrategy as WaveformDisplayXDomainStrategy,
  WaveformOptions as WaveformDisplayOptions,
  SeriesVisibilityChange as WaveformDisplaySeriesVisibilityChange,
  WaveformEvents as WaveformDisplayEvents,
  ToggleSeriesAction as WaveformDisplayToggleSeriesAction,
  WaveformAction as WaveformDisplayAction,
  AnimationEasing as WaveformDisplayAnimationEasing,
  AnimationDirection as WaveformDisplayAnimationDirection,
  AnimationUpdateOptions as WaveformDisplayAnimationUpdateOptions,
  AnimationEnterOptions as WaveformDisplayAnimationEnterOptions,
  WaveformAnimation as WaveformDisplayAnimation,
} from './display'

export type { ControlTheme } from './controls/theme'

export type { PopupOptions, PopupTrigger, PopupPlacement } from './popup'

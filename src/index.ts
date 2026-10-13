/**
 * 波形分析组件库主入口
 * @packageDocumentation
 */

// Vue 组件
export { default as WaveformChart } from './components/WaveformChart.vue'
export type { WaveformChartProps } from './components/core/waveformChartTypes'

// Numeric engine, pure preset factories and owner-scoped chart animation.
export { getEasingFunction } from './animation/core/easing'
export { WaveformAnimationController } from './animation/WaveformAnimationController'
export {
  createLineDrawingAnimation,
  createStaggeredLineDrawingAnimations,
} from './animation/presets/lineDrawing'
export {
  createPathTransitionAnimation,
  createYAxisScaleAnimation,
} from './animation/presets/transitions'
export {
  createAnnotationAppearAnimation,
  createAnnotationDisappearAnimation,
} from './animation/presets/annotation'
export { Animation } from './animation/core/Animation'
export { Animator, globalAnimator } from './animation/core/Animator'
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
} from './animation/core/types'
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
} from './animation/types'

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
  // Includes axes.y.maximumTickVisible and minimumTickVisible for independent extrema ticks.
  WaveformAxesOptions,
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
} from './types/controls'

/**
 * 波形数据点
 */
export interface WaveformPoint {
  x: number
  y: number
  /** Symmetric Y error used when a side-specific value is not provided. */
  error?: number
  /** Error below Y; overrides `error` for the lower side. */
  lowerError?: number
  /** Error above Y; overrides `error` for the upper side. */
  upperError?: number
}

/**
 * 显示模式
 * - independent: 每个波形独立 Y 轴和缩放
 * - separated: 波形垂直堆叠，共享 X 轴
 * - compact: 波形叠加显示
 */
export type WaveformDisplayMode = 'independent' | 'separated' | 'compact'

/** Controls whether overlaid series share one Y axis or use up to four value axes. */
export type WaveformOverlayMode = 'single-axis' | 'multi-axis'

/** 标注工具模式 */
export type WaveformInteractionMode = 'zoom' | 'annotation'

/** 标注颜色样式 */
export interface WaveformAnnotationStyle {
  borderColor?: string
  textColor?: string
  backgroundColor?: string
}

/** 绑定到波形数据坐标的文字标注 */
export interface WaveformAnnotation {
  id: string
  seriesId: string
  x: number
  y: number
  text: string
  /** Pixel offset of the label box from its default position. */
  labelOffsetX?: number
  /** Pixel offset of the label box from its default position. */
  labelOffsetY?: number
  style?: WaveformAnnotationStyle
  createdAt?: string
}

/** Controls how many source points are included in the rendered SVG path. */
export interface WaveformRenderingOptions {
  /** Disable only when every source point must be rendered. */
  downsample?: boolean
  /** Visible point count below which the complete range is rendered. */
  downsampleThreshold?: number
  /** Upper bound for rendered points per horizontal CSS pixel. */
  maxPointsPerPixel?: number
  /** Minimum horizontal CSS-pixel spacing between rendered point symbols. Use 0 to disable. */
  pointMinSpacing?: number
  /** Minimum horizontal CSS-pixel spacing between rendered error bars. Use 0 to disable. */
  errorBarMinSpacing?: number
}

/** Text styling for the chart-level title. */
export interface WaveformTitleTextStyle {
  color?: string
  fontSize?: number
  fontFamily?: string
  rotation?: number
  fontWeight?: number | string
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  letterSpacing?: string
}

/** Options for the title rendered once above the complete waveform grid. */
export interface WaveformTitleOptions {
  visible?: boolean
  text: string
  align?: 'left' | 'center' | 'right'
  textStyle?: WaveformTitleTextStyle
}

/** Preset positions for legends rendered inside multi-series tracks. */
export type WaveformLegendPosition =
  'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left'

/** Controls whether legend items follow the position default or a fixed direction. */
export type WaveformLegendOrientation = 'auto' | 'horizontal' | 'vertical'

/** Options shared by legends in every multi-series track. */
export interface WaveformLegendOptions {
  position?: WaveformLegendPosition
  orientation?: WaveformLegendOrientation
  /** CSS color used by the legend panel; alpha controls background transparency. */
  backgroundColor?: string
  /** Allows legend items to toggle their corresponding series. Defaults to false. */
  interactive?: boolean
}

/** Styling shared by every non-empty waveform frame. */
export interface WaveformFrameStyle {
  borderColor?: string
  borderWidth?: number
  borderStyle?: 'solid' | 'dashed'
  backgroundColor?: string
}

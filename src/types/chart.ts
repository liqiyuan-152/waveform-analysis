/**
 * 波形数据点
 */
export interface WaveformPoint {
  x: number
  y: number
}

/**
 * 显示模式
 * - independent: 每个波形独立 Y 轴和缩放
 * - separated: 波形垂直堆叠，共享 X 轴
 * - compact: 波形叠加显示
 */
export type WaveformDisplayMode = 'independent' | 'separated' | 'compact'

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
}

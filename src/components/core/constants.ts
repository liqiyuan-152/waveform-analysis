/**
 * 波形图表核心常量配置
 */

// ==================== 布局常量 ====================

/** 图表边距 */
export const margin = { top: 18, right: 24, bottom: 52, left: 64 }

/**
 * 图表最小高度（像素）
 */
export const minimumHeight = 180

/**
 * 网格间距配置
 */
export const gridGap = {
  independent: 30,
  separated: 20,
  compact: 20,
}

// ==================== Y轴常量 ====================

/**
 * Y轴字符宽度（像素）
 */
export const Y_AXIS_CHARACTER_WIDTH = 7

/**
 * Y轴刻度内边距（像素）
 */
export const Y_AXIS_TICK_PADDING = 7

/**
 * Y轴外边距（像素）
 */
export const Y_AXIS_OUTER_PADDING = 4

/**
 * Y轴标签间距（像素）
 */
export const Y_AXIS_LABEL_GAP = 6

/**
 * Y轴标签带宽度（像素）
 */
export const Y_AXIS_LABEL_BAND_WIDTH = 24

/**
 * Y轴指数标签间距（像素）
 */
export const Y_AXIS_EXPONENT_GAP = 8

/**
 * 最小绘图宽度（像素）
 */
export const MINIMUM_PLOT_WIDTH = 120

// ==================== 交互常量 ====================

/**
 * 滚轮缩放防抖时间（毫秒）
 */
export const WHEEL_ZOOM_DEBOUNCE_MS = 200

/**
 * 最小选择框尺寸（像素）
 */
export const MINIMUM_SELECTION_SIZE = 6

/**
 * 缩放限制常量
 */
export const ZOOM_CONSTRAINTS = {
  /** 默认最大缩放倍数 */
  DEFAULT_MAX_SCALE: 40,
  /** 最小缩放倍数 */
  MIN_SCALE: 1,
}

/**
 * 悬停检测阈值（像素）
 * 当指针移动距离小于此值时，使用缓存的悬停结果
 */
// ==================== 注释常量 ====================

/**
 * 注释命中半径（像素）
 */
export const ANNOTATION_HIT_RADIUS = 8

/**
 * 注释歧义距离（像素）
 * 当多个候选注释点距离差小于此值时，视为歧义
 */
export const ANNOTATION_AMBIGUITY_DISTANCE = 3

// ==================== 标题常量 ====================

/**
 * 标题区域水平内边距（像素）
 */
export const TITLE_AREA_HORIZONTAL_PADDING = 24

/**
 * 标题默认字体大小（像素）
 */
export const TITLE_DEFAULT_FONT_SIZE = 14

/**
 * 标题默认字符宽度系数
 */
export const TITLE_CHAR_WIDTH_RATIO = 0.62

/**
 * 标题行高
 */
export const TITLE_LINE_HEIGHT = 1.2

// ==================== 样式常量 ====================

/**
 * 通道默认颜色列表
 */
export const channelColors = [
  '#0960bd',
  '#ff7f0e',
  '#389e0d',
  '#cf1322',
  '#531dab',
  '#08979c',
  '#c41d7f',
  '#434343',
  '#7cb305',
  '#1d39c4',
]

/**
 * 错误条默认配置
 */
export const ERROR_BAR_DEFAULTS = {
  /** 线宽（像素） */
  WIDTH: 1.5,
  /** 端帽宽度（像素） */
  CAP_WIDTH: 8,
}

/**
 * 零线默认配置
 */
export const ZERO_LINE_DEFAULTS = {
  /** 颜色 */
  COLOR: '#98a2b3',
  /** 线宽（像素） */
  WIDTH: 1,
  /** 虚线样式 */
  DASH: '6 4',
}

/**
 * 图例默认配置
 */
export const LEGEND_DEFAULTS = {
  /** 背景色 */
  BACKGROUND_COLOR: 'rgba(255, 255, 255, 0.7)',
  /** 位置 */
  POSITION: 'top-right' as const,
  /** 方向 */
  ORIENTATION: 'auto' as const,
}

// ==================== 渲染常量 ====================

/**
 * 最大多轴数量
 */
export const MAX_MULTI_Y_AXIS_COUNT = 4

/**
 * 缓存限制
 */
export const CACHE_LIMITS = {
  /** Y轴组缓存最大条目数 */
  Y_AXIS_GROUPS: 100,
  /** 轨道距离缓存刷新阈值（像素） */
  TRACK_DISTANCE_REFRESH_THRESHOLD: 5,
}

// 向后兼容性导出
export { channelColors as default }

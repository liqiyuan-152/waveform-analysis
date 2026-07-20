/**
 * 工具函数模块统一导出
 */

// 域计算工具
export { paddedDomain, buildMinorTicks } from './domain'

// 格式化工具
export {
  displayTime,
  endpointFractionDigits,
  formatEndpointTime,
  formatAxisTime,
  formatTooltipTime,
  formatAnnotationTime,
  formatPlainNumber,
  formatScientificYAxisLabel,
  formatTooltipNumber,
  shouldUseScientificYAxisLabel,
  type ScientificYAxisLabelOptions,
  type TimeUnit,
} from './formatters'

// 几何计算工具
export { resolveTrackGeometry, clamp, type TrackGeometry } from './geometry'

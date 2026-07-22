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
  formatAxisTimeExponent,
  formatTooltipTime,
  formatAnnotationTime,
  formatPlainNumber,
  formatScientificAxisLabel,
  formatScientificAxisExponent,
  formatScientificYAxisLabel,
  formatTooltipNumber,
  resolveScientificAxisExponent,
  shouldUseScientificAxisLabel,
  shouldUseScientificYAxisLabel,
  type ScientificAxisLabelOptions,
  type ScientificYAxisLabelOptions,
  type TimeUnit,
} from './formatters'

// 几何计算工具
export { resolveTrackGeometry, clamp, type TrackGeometry } from './geometry'

// 数据抽样工具
export {
  downsampleLTTB,
  downsampleMinMax,
  adaptiveSampling,
  calculateSamplingThreshold,
} from './sampling'

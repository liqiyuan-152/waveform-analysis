/**
 * 核心引擎模块统一导出
 */

// 数据处理
export { normalizeWaveformData, normalizeWaveformSeries } from './data'
export {
  DEFAULT_WAVEFORM_RENDERING_OPTIONS,
  resolveWaveformRenderingOptions,
  selectRenderablePoints,
  type ResolvedWaveformRenderingOptions,
} from './rendering'

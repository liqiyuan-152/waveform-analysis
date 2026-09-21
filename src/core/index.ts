/**
 * 核心引擎模块统一导出
 */

// 数据处理
export { normalizeWaveformData, normalizeWaveformSeries, resolveWaveformPointErrors } from './data'
export {
  DEFAULT_WAVEFORM_RENDERING_OPTIONS,
  resolveWaveformRenderingOptions,
  selectDecorationPoints,
  selectRenderablePoints,
  type ResolvedWaveformRenderingOptions,
  type ResolvedWaveformSamplingOptions,
} from './rendering'
export {
  calculateWasmRange,
  findWasmVisibleRange,
  initializeWasmSampling,
  sampleWaveformWasm,
  type WasmRangeMetrics,
  type WasmSamplingRequest,
  type WasmSamplingResult,
  type WasmSamplingStrategy,
} from './wasmSampling'

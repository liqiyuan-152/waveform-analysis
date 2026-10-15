import type { WaveformImageExportError, WaveformImageExportErrorCode } from '../types/controls'

export function imageExportError(code: WaveformImageExportErrorCode): WaveformImageExportError {
  const messages = {
    'export-invalid-options': '图片导出参数无效',
    'export-unavailable': '图表尚未具备有效尺寸',
    'export-busy': '已有导出正在执行',
    'export-cancelled': '图表已卸载，导出取消',
    'export-render-failed': '图片编码失败',
    'export-stale': '图表已变化，请重新导出',
    'export-timeout': '等待图表稳定超时，请重试',
  }
  return Object.assign(new Error(messages[code]), { code })
}

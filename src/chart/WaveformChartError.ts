import type { WaveformChartErrorCode } from '../types/native'

export class WaveformChartError extends Error {
  readonly code: WaveformChartErrorCode
  readonly field?: string

  constructor(code: WaveformChartErrorCode, message: string, field?: string) {
    super(message)
    this.name = 'WaveformChartError'
    this.code = code
    this.field = field
  }
}

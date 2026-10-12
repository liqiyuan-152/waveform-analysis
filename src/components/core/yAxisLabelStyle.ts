import type { WaveformYAxisLabelTextStyle } from '../../types'

export function resolveYAxisLabelFontSize(style?: WaveformYAxisLabelTextStyle): number {
  const size = style?.fontSize
  return typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : 12
}

export function resolveYAxisLabelBandWidth(style?: WaveformYAxisLabelTextStyle): number {
  return resolveYAxisLabelFontSize(style) + 8
}
